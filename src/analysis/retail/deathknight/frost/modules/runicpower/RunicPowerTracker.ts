import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { Options } from 'parser/core/Analyzer';
import { ResourceChangeEvent } from 'parser/core/Events';
import ResourceTracker from 'parser/shared/modules/resources/resourcetracker/ResourceTracker';

class RunicPowerTracker extends ResourceTracker {
  constructor(options: Options) {
    super(options);
    this.resource = RESOURCE_TYPES.RUNIC_POWER;
  }

  /** All RP amounts multiplied by 10 - except gain and waste for some reason */
  getAdjustedGain(event: ResourceChangeEvent): { gain: number; waste: number } {
    const baseGain = super.getAdjustedGain(event);
    return { gain: baseGain.gain * 10, waste: baseGain.waste * 10 };
  }

  // getAdjustedCost(event: CastEvent) {
  //   const cost = this.getResource(event)?.cost;
  //   if (cost) {
  //     return cost / 10;
  //   }
  // }
}

export default RunicPowerTracker;
