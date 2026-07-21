import { FacilityStatus } from '../world/Facility.js';

// Tier 7+ observability: a real composite health score computed from
// live engine state, powering the Eval panel (see the Hub redesign in
// RENDERER_INTEGRATION_FINDINGS.md) instead of Micropolis' crime/
// pollution/traffic/happiness census, which src/engine has no data for
// and was never designed to have. Three sub-scores, each 0-100:
//
// - vitality: the fraction of this city's facilities that are actually
//   ACTIVE (producing) rather than STALLED (blocked on missing input) -
//   the real, already-tracked signal for "is the local economy working."
// - solvency: how comfortably this city could afford to keep developing,
//   relative to the cheapest thing it could build - not "is the number
//   positive" (CityBudget.allocation can't go negative in normal play,
//   see ZoneResolver's affordability gate), but "is there real headroom."
// - strain: inverse of average corridor congestion serving this city -
//   the same load/capacity ratio the region-view's corridor coloring
//   already uses, just expressed as a health contributor instead of a
//   line color.
export function evaluateCity ( city, region ) {

    const facilities = Array.from( city.facilities.values() );
    const vitality = facilities.length === 0
        ? 100
        : 100 * facilities.filter( f => f.status === FacilityStatus.ACTIVE ).length / facilities.length;

    const totalFunds = city.budget ? city.budget.totalFunds : 0;
    const buildCosts = region.recipes.all().map( r => r.buildCost ).filter( c => c > 0 );
    const cheapestBuildCost = buildCosts.length > 0 ? Math.min( ...buildCosts ) : 1;
    // Comfortably solvent (100) means affording at least two of the
    // cheapest thing this region can build - a real, content-derived
    // threshold, not an arbitrary dollar figure.
    const solvency = Math.min( 100, 100 * totalFunds / ( cheapestBuildCost * 2 ) );

    const corridors = region.corridorsFor( city.id );
    const avgUtilization = corridors.length === 0 ? 0 : corridors.reduce(
        ( sum, c ) => sum + ( c.capacity > 0 ? c.load / c.capacity : 0 ), 0,
    ) / corridors.length;
    const strain = 100 * ( 1 - Math.min( 1, avgUtilization ) );

    const score = Math.round( ( vitality + solvency + strain ) / 3 );

    return {
        score,
        vitality: Math.round( vitality ),
        solvency: Math.round( solvency ),
        strain: Math.round( strain ),
        facilityCount: facilities.length,
        activeCount: facilities.filter( f => f.status === FacilityStatus.ACTIVE ).length,
        stalledCount: facilities.filter( f => f.status === FacilityStatus.STALLED ).length,
    };

}
