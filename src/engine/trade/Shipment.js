export const ShipmentState = Object.freeze( {
    PENDING: 'pending',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    STALLED: 'stalled',
} );

let _shipmentSequence = 0;

// Called by persistence/RegionSerializer.js after loading a save, so
// newly-created shipments post-load get ids past every id already in the
// save rather than colliding with them (the counter otherwise restarts at
// 0 on a fresh page load / fresh RegionState).
export function setShipmentSequence ( n ) {

    _shipmentSequence = Math.max( _shipmentSequence, n );

}

// A traceable cargo agent: the primitive that makes automated trade
// observable instead of a black box (see COUNTRY_SIM_ENGINE_PLAN §Tier 1).
export class Shipment {

    constructor ( { commodityId, quantity, originFacilityId, destinationFacilityId, chainStage = 0, path = [], distance = 1 } ) {

        this.id = `shipment-${ ++ _shipmentSequence }`;

        this.commodityId = commodityId;
        this.quantity = quantity;

        this.originFacilityId = originFacilityId;
        this.destinationFacilityId = destinationFacilityId;
        this.chainStage = chainStage;

        this.path = path;         // CorridorEdge ids traversed, [] for a same-city move
        this.distance = distance; // total route distance, drives transit time

        this.state = ShipmentState.PENDING;
        this.progress = 0; // 0..1 along its route, owned by the transport/traffic layer

        this.history = [ { state: this.state, tick: null } ];

    }

    setState ( state, tick ) {

        this.state = state;
        this.history.push( { state, tick } );

    }

}
