import type { JSX } from 'react';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/deathknight';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import GradiatedPerformanceBar from 'interface/guide/components/GradiatedPerformanceBar';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyBuffEvent, RefreshBuffEvent, RemoveBuffEvent } from 'parser/core/Events';
import { ThresholdStyle } from 'parser/core/ParseResults';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

const BUFF_DURATION_SEC = 15;

class RimeEfficiency extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };

  rimeProcs = 0;
  lastProcTime = 0;
  refreshedRimeProcs = 0;
  expiredRimeProcs = 0;

  constructor(options: Options) {
    super(options);

    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onApplyBuff,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onRemoveBuff,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.RIME),
      this.onRefreshBuff,
    );
  }

  onApplyBuff(event: ApplyBuffEvent) {
    this.rimeProcs += 1;
    this.lastProcTime = event.timestamp;
  }

  onRemoveBuff(event: RemoveBuffEvent) {
    const durationHeld = event.timestamp - this.lastProcTime;
    if (durationHeld > BUFF_DURATION_SEC * 1000) {
      this.expiredRimeProcs += 1;
    }
  }

  onRefreshBuff(event: RefreshBuffEvent) {
    this.refreshedRimeProcs += 1;
    this.rimeProcs += 1;
  }

  get totalWastedProcs() {
    return this.refreshedRimeProcs + this.expiredRimeProcs;
  }

  get wastedProcRate() {
    return this.totalWastedProcs / this.rimeProcs;
  }

  get efficiency() {
    return 1 - this.wastedProcRate;
  }

  get suggestionThresholds() {
    return {
      actual: this.efficiency,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.85,
      },
      style: ThresholdStyle.PERCENTAGE,
      suffix: 'Average',
    };
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(5)}
        size="flexible"
        tooltip={`You wasted ${this.totalWastedProcs} out of ${
          this.rimeProcs
        } Rime procs (${formatPercentage(this.wastedProcRate)}%).  ${
          this.expiredRimeProcs
        } procs expired without being used and ${
          this.refreshedRimeProcs
        } procs were overwritten by new procs.`}
      >
        <BoringSpellValueText spell={SPELLS.RIME}>
          <>
            {formatPercentage(this.efficiency)} % <small>efficiency</small>
          </>
        </BoringSpellValueText>
      </Statistic>
    );
  }

  get guideSubsection(): JSX.Element {
    const goodRimes = {
      count: this.rimeProcs - this.expiredRimeProcs - this.refreshedRimeProcs,
      label: 'Consumed Rimes',
    };

    const refreshedRimes = {
      count: this.refreshedRimeProcs,
      label: 'Refreshed Rimes',
    };

    const expiredRimes = {
      count: this.expiredRimeProcs,
      label: 'Expired Rimes',
    };

    const explanation = (
      <p>
        <strong>
          <SpellLink spell={SPELLS.RIME} />
        </strong>{' '}
        turns <SpellLink spell={talents.HOWLING_BLAST_TALENT} /> from a weak ability you only use to
        apply Frost Fever to a powerful spell that jumps to the top of the priority list. Rime has a
        45% chance to proc from <SpellLink spell={talents.FROST_STRIKE_TALENT} /> and{' '}
        <SpellLink spell={SPELLS.GLACIAL_ADVANCE} />. Each Rime consumed also reduces the cooldown
        of <SpellLink spell={talents.EMPOWER_RUNE_WEAPON_TALENT} /> by 6 seconds via{' '}
        <SpellLink spell={talents.FROSTBOUND_WILL_TALENT} />. You should aim to consume every Rime
        proc immediately — letting procs expire or get overwritten is a significant loss.
      </p>
    );

    const data = (
      <div>
        <strong>Rime breakdown</strong>
        <GradiatedPerformanceBar good={goodRimes} ok={refreshedRimes} bad={expiredRimes} />
      </div>
    );

    return explanationAndDataSubsection(explanation, data, 50);
  }
}

export default RimeEfficiency;
