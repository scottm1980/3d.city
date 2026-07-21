import { CityState } from '../world/CityState.js';
import { CorridorEdge } from '../world/CorridorEdge.js';
import { Facility } from '../world/Facility.js';
import { ResourceEndowment } from '../world/ResourceEndowment.js';
import { Shipment, setShipmentSequence } from '../trade/Shipment.js';
import { setFacilitySequence } from '../resolution/ZoneResolver.js';

// Real save/load for src/engine: RegionState/CityState serialization was
// completely unbuilt until now (see RENDERER_INTEGRATION_FINDINGS.md's
// "still open" list). Scope is deliberately the live simulation state
// only - resource/recipe registries are content/config, not save data,
// exactly like every dev preview already treats them (register
// DefaultResourceTypes/DefaultRecipes fresh, then build/restore a region
// on top). serializeRegion()/applyRegionSnapshot() do not touch
// CityHistory/AchievementTracker (session-local observability, not part
// of RegionState) - a documented, deliberate scope cut, not an oversight.
//
// applyRegionSnapshot() expects a FRESH RegionState: resources/recipes
// already registered, but zero cities/corridors/shipments added yet -
// restoring into an already-populated region would double-register
// cities and is refused outright rather than silently corrupting state.
export function serializeRegion ( region ) {

    return {
        id: region.id,
        name: region.name,
        tick: region.tick,
        nationalBudget: {
            treasury: region.nationalBudget.treasury,
            cityAllocations: Array.from( region.nationalBudget.cityAllocations.entries() ).map( ( [ cityId, budget ] ) => ( [
                cityId,
                { allocation: budget.allocation, localRevenue: budget.localRevenue, spend: Array.from( budget.spend.entries() ) },
            ] ) ),
        },
        cities: Array.from( region.cities.values() ).map( serializeCity ),
        corridors: Array.from( region.corridors.values() ).map( serializeCorridor ),
        shipments: Array.from( region.shipments.values() ).map( serializeShipment ),
    };

}

function serializeCity ( city ) {

    return {
        id: city.id,
        name: city.name,
        controlMode: city.controlMode,
        regionPosition: city.regionPosition,
        width: city.width,
        height: city.height,
        tick: city.tick,
        ordinances: { ...city.ordinances },
        lots: city.lots.map( lot => ( {
            x: lot.x,
            y: lot.y,
            terrain: lot.terrain,
            zoneType: lot.zoneType,
            occupiedBy: lot.occupiedBy,
            resourceEndowment: lot.resourceEndowment
                ? { resourceId: lot.resourceEndowment.resourceId, richness: lot.resourceEndowment.richness }
                : null,
        } ) ),
        facilities: Array.from( city.facilities.values() ).map( f => ( {
            id: f.id,
            archetypeId: f.archetypeId,
            anchor: { x: f.lot.x, y: f.lot.y },
            footprint: f.footprint.map( l => ( { x: l.x, y: l.y } ) ),
            level: f.level,
            status: f.status,
            inputStock: Array.from( f.inputStock.entries() ),
            outputStock: Array.from( f.outputStock.entries() ),
            disruptedUntilTick: f.disruptedUntilTick,
        } ) ),
    };

}

function serializeCorridor ( c ) {

    return {
        id: c.id, cityAId: c.cityAId, cityBId: c.cityBId, mode: c.mode,
        distance: c.distance, capacity: c.capacity, load: c.load,
        disruptedUntilTick: c.disruptedUntilTick, disruptionCapacityFactor: c.disruptionCapacityFactor,
    };

}

function serializeShipment ( s ) {

    return {
        id: s.id, commodityId: s.commodityId, quantity: s.quantity,
        originFacilityId: s.originFacilityId, destinationFacilityId: s.destinationFacilityId,
        chainStage: s.chainStage, path: s.path, distance: s.distance,
        state: s.state, progress: s.progress, history: s.history,
    };

}

export function applyRegionSnapshot ( region, snapshot ) {

    if ( region.cities.size > 0 || region.corridors.size > 0 || region.shipments.size > 0 ) {

        throw new Error( 'applyRegionSnapshot requires a fresh RegionState with no cities/corridors/shipments yet' );

    }

    region.tick = snapshot.tick;
    region.nationalBudget.treasury = snapshot.nationalBudget.treasury;

    for ( const cityData of snapshot.cities ) region.addCity( deserializeCity( cityData ) );

    // region.addCity() just assigned every city a fresh CityBudget
    // (STARTING_ALLOCATION) via NationalBudget.registerCity() - overwrite
    // its fields with the saved values now that every budget object
    // exists (city.budget and nationalBudget.cityAllocations.get(cityId)
    // are the same object, so this updates both).
    for ( const [ cityId, budgetData ] of snapshot.nationalBudget.cityAllocations ) {

        const budget = region.nationalBudget.cityAllocations.get( cityId );
        if ( ! budget ) continue;
        budget.allocation = budgetData.allocation;
        budget.localRevenue = budgetData.localRevenue;
        budget.spend = new Map( budgetData.spend );

    }

    for ( const corridorData of snapshot.corridors ) {

        region.addCorridor( new CorridorEdge( corridorData.id, corridorData.cityAId, corridorData.cityBId, {
            mode: corridorData.mode, distance: corridorData.distance, capacity: corridorData.capacity,
        } ) );
        const corridor = region.corridors.get( corridorData.id );
        corridor.load = corridorData.load;
        corridor.disruptedUntilTick = corridorData.disruptedUntilTick;
        corridor.disruptionCapacityFactor = corridorData.disruptionCapacityFactor;

    }

    let maxFacilitySeq = 0;
    for ( const cityData of snapshot.cities ) {

        for ( const f of cityData.facilities ) maxFacilitySeq = Math.max( maxFacilitySeq, sequenceNumber( f.id ) );

    }
    setFacilitySequence( maxFacilitySeq );

    let maxShipmentSeq = 0;
    for ( const shipmentData of snapshot.shipments ) {

        region.addShipment( deserializeShipment( shipmentData ) );
        maxShipmentSeq = Math.max( maxShipmentSeq, sequenceNumber( shipmentData.id ) );

    }
    setShipmentSequence( maxShipmentSeq );

}

function sequenceNumber ( id ) {

    const match = /-(\d+)$/.exec( id );
    return match ? Number( match[ 1 ] ) : 0;

}

function deserializeCity ( data ) {

    const city = new CityState( data.id, data.name, {
        width: data.width, height: data.height, controlMode: data.controlMode, regionPosition: data.regionPosition,
    } );
    city.tick = data.tick;
    city.ordinances = { ...data.ordinances };

    for ( const lotData of data.lots ) {

        const lot = city.lotAt( lotData.x, lotData.y );
        lot.terrain = lotData.terrain;
        lot.zoneType = lotData.zoneType;
        lot.occupiedBy = lotData.occupiedBy;
        lot.resourceEndowment = lotData.resourceEndowment
            ? new ResourceEndowment( lotData.resourceEndowment.resourceId, lotData.resourceEndowment.richness )
            : null;

    }

    for ( const fData of data.facilities ) {

        const anchorLot = city.lotAt( fData.anchor.x, fData.anchor.y );
        const facility = new Facility( fData.id, fData.archetypeId, anchorLot );
        facility.footprint = fData.footprint.map( p => city.lotAt( p.x, p.y ) );
        facility.level = fData.level;
        facility.status = fData.status;
        facility.inputStock = new Map( fData.inputStock );
        facility.outputStock = new Map( fData.outputStock );
        facility.disruptedUntilTick = fData.disruptedUntilTick;

        anchorLot.facility = facility;
        city.facilities.set( facility.id, facility );

    }

    return city;

}

function deserializeShipment ( data ) {

    const shipment = new Shipment( {
        commodityId: data.commodityId, quantity: data.quantity,
        originFacilityId: data.originFacilityId, destinationFacilityId: data.destinationFacilityId,
        chainStage: data.chainStage, path: data.path, distance: data.distance,
    } );
    // The constructor auto-assigns a fresh sequential id - overwrite with
    // the saved one so it stays stable across a save/load cycle (matters
    // for anything that ever surfaces a shipment id, e.g. a future
    // per-shipment inspector).
    shipment.id = data.id;
    shipment.state = data.state;
    shipment.progress = data.progress;
    shipment.history = data.history;

    return shipment;

}

// RegionOrchestrator itself isn't part of RegionState, but its two bits of
// mutable state (tick count, RNG state) are trivial and worth carrying
// across a save/load so automated growth timing/randomness resumes
// exactly where it left off, rather than silently resetting. Optional:
// callers that don't have an orchestrator handy (or don't care about
// resuming determinism) can skip these.
export function serializeOrchestrator ( orchestrator ) {

    return { orchestratorTick: orchestrator.orchestratorTick, rngState: orchestrator.rng._state };

}

export function applyOrchestratorSnapshot ( orchestrator, snapshot ) {

    if ( ! snapshot ) return;
    orchestrator.orchestratorTick = snapshot.orchestratorTick;
    orchestrator.rng._state = snapshot.rngState;

}
