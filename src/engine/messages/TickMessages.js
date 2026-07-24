// Message envelope shapes shared by the Tier 7 orchestrator and its Worker(s).
// This file defines the vocabulary only — dispatch/scheduling is Tier 7's job.
export const TickMessageType = Object.freeze( {
    REGION_TICK: 'REGION_TICK',
    CITY_SNAPSHOT: 'CITY_SNAPSHOT',
    SHIPMENT_UPDATE: 'SHIPMENT_UPDATE',
    BUDGET_UPDATE: 'BUDGET_UPDATE',
} );

export function tickMessage ( type, payload ) {

    return { type, payload };

}
