export const FacilityStatus = Object.freeze( {
    GROWING: 'growing',
    ACTIVE: 'active',
    STALLED: 'stalled',      // starved of an input resource
    ABANDONED: 'abandoned',
} );

export class Facility {

    constructor ( id, archetypeId, lot ) {

        this.id = id;
        this.archetypeId = archetypeId; // links to a Recipe.facilityArchetype
        this.lot = lot;

        this.level = 1;
        this.status = FacilityStatus.GROWING;

        this.inputStock = new Map();    // resourceId -> quantity buffered, awaiting consumption
        this.outputStock = new Map();   // resourceId -> quantity buffered, awaiting shipment

    }

}
