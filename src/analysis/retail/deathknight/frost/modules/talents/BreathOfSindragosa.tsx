import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/deathknight';
import { SpellLink } from 'interface';
import CooldownExpandable, {
  CooldownExpandableItem,
} from 'interface/guide/components/CooldownExpandable';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import Analyzer, { SELECTED_PLAYER, Options } from 'parser/core/Analyzer';
import Events, {
  CastEvent,
  RemoveBuffEvent,
  RemoveBuffStackEvent,
  FightEndEvent,
} from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Statistic from 'parser/ui/Statistic';
import { STATISTIC_ORDER } from 'parser/ui/StatisticBox';
import { PerformanceMark } from 'interface/guide';

// Thresholds based on 8s base + 0.8s per proc — needs tuning with real Midnight data
const GOOD_BREATH_DURATION_MS = 20000; // ~15 procs consumed
const OK_BREATH_DURATION_MS = 12000; // ~5 procs consumed
const GOOD_RP_TO_CAST = 80;
const MIN_RP_TO_CAST = 65;

class BreathOfSindragosa extends Analyzer {
  beginTimestamp = 0;
  casts = 0;
  totalDuration = 0;
  startingRunicPower = 0;
  breathActive = false;
  currentCastKmConsumed = 0;
  currentCastRimeConsumed = 0;

  castTracker: breathCast[] = [];

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(talents.BREATH_OF_SINDRAGOSA_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(talents.BREATH_OF_SINDRAGOSA_TALENT),
      this.onCast,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(talents.BREATH_OF_SINDRAGOSA_TALENT),
      this.onRemoveBuff,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.KILLING_MACHINE),
      this.onKmConsume,
    );
    this.addEventListener(
      Events.removebuffstack.by(SELECTED_PLAYER).spell(SPELLS.KILLING_MACHINE),
      this.onKmConsume,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onRimeConsume,
    );
    this.addEventListener(Events.fightend, this.onFightEnd);
  }

  onCast(event: CastEvent) {
    if (!this.breathActive) {
      this.casts += 1;
      this.beginTimestamp = event.timestamp;
      this.breathActive = true;
      this.startingRunicPower = event.classResources?.at(0)?.amount ?? 0;
      this.currentCastKmConsumed = 0;
      this.currentCastRimeConsumed = 0;
    }
  }

  onRemoveBuff(event: RemoveBuffEvent) {
    this.breathActive = false;
    const duration = event.timestamp - this.beginTimestamp;
    this.totalDuration += duration;
    this.castTracker.push({
      timestamp: this.beginTimestamp,
      startingRunicPower: this.startingRunicPower / 10,
      duration: duration / 1000,
      kmConsumed: this.currentCastKmConsumed,
      rimeConsumed: this.currentCastRimeConsumed,
      fightEnded: false,
    });
  }

  onKmConsume(event: RemoveBuffEvent | RemoveBuffStackEvent) {
    if (this.breathActive) {
      this.currentCastKmConsumed += 1;
    }
  }

  onRimeConsume(event: RemoveBuffEvent) {
    if (this.breathActive) {
      this.currentCastRimeConsumed += 1;
    }
  }

  onFightEnd(event: FightEndEvent) {
    if (this.breathActive) {
      const duration = event.timestamp - this.beginTimestamp;
      this.castTracker.push({
        timestamp: this.beginTimestamp,
        startingRunicPower: this.startingRunicPower / 10,
        duration: duration / 1000,
        kmConsumed: this.currentCastKmConsumed,
        rimeConsumed: this.currentCastRimeConsumed,
        fightEnded: true,
      });
    }
  }

  get tickingOnFinishedString() {
    return this.breathActive
      ? 'Your final cast was still active when the fight ended and was not counted in the average'
      : '';
  }

  get averageDuration() {
    return (this.totalDuration / this.casts || 0) / 1000;
  }

  get suggestionThresholds() {
    return {
      actual: this.averageDuration,
      isLessThan: {
        minor: GOOD_BREATH_DURATION_MS / 1000,
        average: OK_BREATH_DURATION_MS / 1000,
        major: OK_BREATH_DURATION_MS / 1000 - 2,
      },
      style: ThresholdStyle.SECONDS,
      suffix: 'Average',
    };
  }

  statistic() {
    return (
      <Statistic
        tooltip={`You cast Breath of Sindragosa ${this.casts} times for a combined total of ${(
          this.totalDuration / 1000
        ).toFixed(1)} seconds. ${this.tickingOnFinishedString}`}
        position={STATISTIC_ORDER.CORE(60)}
        size="flexible"
      >
        <BoringSpellValueText spell={talents.BREATH_OF_SINDRAGOSA_TALENT}>
          <>
            {this.averageDuration.toFixed(1)}s <small>average duration</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <b>
          <SpellLink spell={talents.BREATH_OF_SINDRAGOSA_TALENT} />
        </b>{' '}
        has a base duration of 8 seconds, extended by 0.8 seconds for every{' '}
        <SpellLink spell={SPELLS.KILLING_MACHINE} /> or <SpellLink spell={SPELLS.RIME} /> proc
        consumed while active. Activate it at the start of{' '}
        <SpellLink spell={talents.PILLAR_OF_FROST_TALENT} /> and feed every proc to maximize its
        duration.
      </p>
    );

    const data = (
      <div>
        <strong>Per-Cast Breakdown</strong>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }

  get guideCastBreakdown() {
    const explanation = (
      <p>
        <strong>
          <SpellLink spell={talents.BREATH_OF_SINDRAGOSA_TALENT} />
        </strong>{' '}
        costs 60 Runic Power to activate and has a base duration of 8 seconds. Each{' '}
        <SpellLink spell={SPELLS.KILLING_MACHINE} /> or <SpellLink spell={SPELLS.RIME} /> proc
        consumed while it is active extends it by 0.8 seconds. Activate at the start of{' '}
        <SpellLink spell={talents.PILLAR_OF_FROST_TALENT} /> with enough RP pooled, then feed every
        proc into it.
      </p>
    );

    const data = (
      <div>
        <strong>Per-Cast Breakdown</strong>
        <small> - click to expand</small>
        {this.castTracker.map((cast, idx) => {
          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.timestamp)} &mdash;{' '}
              <SpellLink spell={talents.BREATH_OF_SINDRAGOSA_TALENT} />
            </>
          );
          const checklistItems: CooldownExpandableItem[] = [];

          const rpPoolingPerf =
            cast.startingRunicPower >= GOOD_RP_TO_CAST
              ? QualitativePerformance.Good
              : cast.startingRunicPower >= MIN_RP_TO_CAST
                ? QualitativePerformance.Ok
                : QualitativePerformance.Fail;
          checklistItems.push({
            label: 'Runic Power on cast',
            result: <PerformanceMark perf={rpPoolingPerf} />,
            details: <>{cast.startingRunicPower} RP</>,
          });

          const durationPerf = cast.fightEnded
            ? QualitativePerformance.Good
            : cast.duration * 1000 >= GOOD_BREATH_DURATION_MS
              ? QualitativePerformance.Good
              : cast.duration * 1000 >= OK_BREATH_DURATION_MS
                ? QualitativePerformance.Ok
                : QualitativePerformance.Fail;
          checklistItems.push({
            label: 'Breath duration',
            result: <PerformanceMark perf={durationPerf} />,
            details: <>{cast.duration.toFixed(1)}s</>,
          });

          checklistItems.push({
            label: 'Procs consumed',
            result: <></>,
            details: (
              <>
                {cast.kmConsumed} <SpellLink spell={SPELLS.KILLING_MACHINE} /> / {cast.rimeConsumed}{' '}
                <SpellLink spell={SPELLS.RIME} />
              </>
            ),
          });

          const overallPerf =
            cast.fightEnded || cast.duration * 1000 >= GOOD_BREATH_DURATION_MS
              ? QualitativePerformance.Good
              : cast.duration * 1000 >= OK_BREATH_DURATION_MS
                ? QualitativePerformance.Ok
                : QualitativePerformance.Fail;

          return (
            <CooldownExpandable
              header={header}
              checklistItems={checklistItems}
              perf={overallPerf}
              key={idx}
            />
          );
        })}
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}

interface breathCast {
  timestamp: number;
  startingRunicPower: number;
  duration: number;
  kmConsumed: number;
  rimeConsumed: number;
  fightEnded: boolean;
}

export default BreathOfSindragosa;
