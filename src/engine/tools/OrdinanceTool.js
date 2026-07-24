// Real per-city policy levers - the tool equivalent of ZoningTool/
// BulldozeTool, but toggling ordinances rather than editing tiles. Powers
// the Ordinances panel (see the Hub redesign in
// RENDERER_INTEGRATION_FINDINGS.md) with genuine mechanical effects on the
// budget system instead of a Micropolis-style tax-rate slider src/engine
// has no use for:
//
// - priorityFunding: boosts this city's weight in NationalBudget's
//   per-tick weighted allocation (see budget/NationalBudget.js), at every
//   other city's expense - the split is zero-sum.
// - exportTariff: increases the production tax revenue this city's
//   facilities send into the shared national treasury (see
//   trade/TradeResolver.js's _produceAndConsume).
//
// Unlike zoning/bulldozing, ordinances aren't control-mode gated - they
// represent a policy decision applied to a city, not a tile edit, and
// apply equally whether the city is player-managed or automated.
export const OrdinanceId = Object.freeze( {
    PRIORITY_FUNDING: 'priorityFunding',
    EXPORT_TARIFF: 'exportTariff',
} );

export class OrdinanceTool {

    set ( city, ordinanceId, enabled ) {

        if ( ! ( ordinanceId in city.ordinances ) ) throw new Error( `Unknown ordinance: ${ ordinanceId }` );

        city.ordinances[ ordinanceId ] = !! enabled;
        return city.ordinances[ ordinanceId ];

    }

    toggle ( city, ordinanceId ) {

        return this.set( city, ordinanceId, ! city.ordinances[ ordinanceId ] );

    }

    isEnabled ( city, ordinanceId ) {

        return !! city.ordinances[ ordinanceId ];

    }

}
