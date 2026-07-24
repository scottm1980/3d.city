import { ControlMode } from '../world/CityState.js';
import { undevelopLot } from '../resolution/ZoneResolver.js';

// The demolition counterpart to ZoningTool - same control-mode scoping
// (managed cities only; an automated city's growth isn't player-editable
// any more than it's player-zoneable, per the round-2 decision).
export class BulldozeTool {

    // Removes whatever facility occupies `lot`, if any. `lot` can be any
    // tile inside a multi-tile facility's footprint, not just its anchor -
    // resolved via Lot.occupiedBy before delegating to undevelopLot(), the
    // same "click anywhere in the building" behavior the real renderer's
    // own bulldozer tool has (View.js's testDestruct scans a footprint's
    // full tile list, not just one corner). Returns the removed Facility,
    // or null if the lot wasn't developed.
    demolish ( city, lot ) {

        if ( city.controlMode !== ControlMode.MANAGED ) {

            throw new Error( `BulldozeTool only operates on managed cities; ${ city.id } is ${ city.controlMode }` );

        }

        if ( ! lot.isDeveloped ) return null;

        const facility = city.facilities.get( lot.occupiedBy );
        return undevelopLot( city, facility.lot );

    }

}
