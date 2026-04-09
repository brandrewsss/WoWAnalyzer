import talents from 'common/TALENTS/deathknight';
import RESOURCE_TYPES, { getResource } from 'game/RESOURCE_TYPES';
import SpellLink from 'interface/SpellLink';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { PerformanceMark } from 'interface/guide';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';

// ERW grants 40 RP flat. RP cap is 125. Waste occurs if RP > 85 at cast time.
const MAX_RP_NO_WASTE = 85;

interface ErwCast {
  timestamp: number;
  rpAtCast: number;
}

export default class EmpowerRuneWeapon extends Analyzer {
  erwTracker: ErwCast[] = [];

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(talents.EMPOWER_RUNE_WEAPON_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(talents.EMPOWER_RUNE_WEAPON_TALENT),
      this.onErwCast,
    );
  }

  onErwCast(event: CastEvent) {
    const rpEntry = getResource(event.classResources, RESOURCE_TYPES.RUNIC_POWER.id);
    const rpAtCast = (rpEntry?.amount ?? 0) / 10;

    this.erwTracker.push({
      timestamp: event.timestamp,
      rpAtCast,
    });
  }

  get guideCastBreakdown() {
    const explanation = (
      <p>
        <strong>
          <SpellLink spell={talents.EMPOWER_RUNE_WEAPON_TALENT} />
        </strong>{' '}
        is an off-GCD cooldown with 2 charges that instantly deals damage, grants 40 Runic Power, a
        Killing Machine proc, and resets Rune cooldowns. Use both charges as close to on cooldown as
        possible, ideally during <SpellLink spell={talents.PILLAR_OF_FROST_TALENT} />. Avoid casting
        when your Runic Power is above 85 — any RP granted above the 125 cap is wasted.
      </p>
    );

    const data = (
      <div>
        <strong>Per-Cast Breakdown</strong>
        <div>
          {this.erwTracker.map((cast, idx) => {
            const rpPerf =
              cast.rpAtCast <= MAX_RP_NO_WASTE
                ? QualitativePerformance.Good
                : QualitativePerformance.Fail;

            return (
              <div key={idx}>
                @ {this.owner.formatTimestamp(cast.timestamp)} &mdash;{' '}
                <SpellLink spell={talents.EMPOWER_RUNE_WEAPON_TALENT} /> &mdash;{' '}
                {Math.round(cast.rpAtCast)} RP <PerformanceMark perf={rpPerf} />
              </div>
            );
          })}
        </div>
      </div>
    );

    return explanationAndDataSubsection(explanation, data);
  }
}
