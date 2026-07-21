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
        this.lot = lot;                 // anchor lot (footprint center)
        this.footprint = [ lot ];       // every Lot this facility occupies, anchor included - set for real by developLot()

        this.level = 1;
        this.status = FacilityStatus.GROWING;

        this.inputStock = new Map();    // resourceId -> quantity buffered, awaiting consumption
        this.outputStock = new Map();   // resourceId -> quantity buffered, awaiting shipment

        // Set by DisruptionTool (a "supply shock"): while region.tick is
        // below this, TradeResolver skips production for this facility
        // regardless of input stock, distinct from a normal STALLED (which
        // means "missing inputs" and clears itself the moment supply
        // arrives). null means not disrupted.
        this.disruptedUntilTick = null;

    }

}
