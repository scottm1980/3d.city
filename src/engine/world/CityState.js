import { Lot } from './Lot.js';

export const ControlMode = Object.freeze( {
    MANAGED: 'managed',      // full player tools, full-fidelity per-tile simulation
    AUTOMATED: 'automated',  // heuristic-driven, coarse simulation
} );

export class CityState {

    constructor ( id, name, { width, height, controlMode = ControlMode.AUTOMATED } = {} ) {

        this.id = id;
        this.name = name;
        this.controlMode = controlMode;

        this.width = width;
        this.height = height;
        this.lots = CityState._buildLotGrid( width, height );

        this.facilities = new Map(); // facilityId -> Facility

        this.budget = null;          // CityBudget, assigned by RegionState.addCity()

        this.tick = 0;

    }

    static _buildLotGrid ( width, height ) {

        const lots = [];

        for ( let y = 0; y < height; y ++ ) {

            for ( let x = 0; x < width; x ++ ) {

                lots.push( new Lot( x, y ) );

            }

        }

        return lots;

    }

    lotAt ( x, y ) {

        if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) return null;
        return this.lots[ y * this.width + x ];

    }

    get isManaged () {

        return this.controlMode === ControlMode.MANAGED;

    }

}
