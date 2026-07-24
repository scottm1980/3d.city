// Set by the Tier 2 map generator; read-only for the rest of the engine.
export class ResourceEndowment {

    constructor ( resourceId, richness = 1 ) {

        this.resourceId = resourceId;
        this.richness = richness; // 0..1, scales extraction throughput on this lot

    }

}
