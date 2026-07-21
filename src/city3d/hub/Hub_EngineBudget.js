import { Hub_Pannel } from './Hub_Pannel.js';

//------------------------------------------------------//
//   BUDGET PANEL FOR src/engine's TWO-TIER MODEL        //
//------------------------------------------------------//
// The original Hub_Budget.js panel is tax rates + per-service funding
// percentages + municipal bonds - a Micropolis-specific model src/engine
// never had and was never designed to have. This shows what the engine
// actually tracks: the national treasury, this city's allocation from
// it, and where that allocation has actually been spent (CityBudget.spend,
// a real Map keyed by facility archetype - not synthesized for this
// panel, the exact bookkeeping ZoneResolver.developLot() already writes
// via CityBudget.spendOn()).
export class Hub_EngineBudget extends Hub_Pannel {

	init () {

		const body = document.createElement( 'div' );
		body.style.cssText = 'padding:10px 12px; pointer-events:none; color:var(--c-text); font-size:12px; line-height:1.7;';
		this.pannel.appendChild( body );

		this.treasuryRow = this._row( body, 'National treasury' );
		this.allocationRow = this._row( body, 'This city\'s allocation' );

		this.spendLabel = document.createElement( 'div' );
		this.spendLabel.style.cssText = 'font-size:10px; font-weight:700; letter-spacing:0.08em; color:var(--c-accent-hi); text-transform:uppercase; margin:10px 0 4px;';
		this.spendLabel.textContent = 'Spent by facility type';
		body.appendChild( this.spendLabel );

		this.spendList = document.createElement( 'div' );
		body.appendChild( this.spendList );

	}

	_row ( body, label ) {

		const row = document.createElement( 'div' );
		row.style.cssText = 'display:flex; justify-content:space-between; gap:14px;';
		const labelEl = document.createElement( 'span' );
		labelEl.style.color = 'var(--c-text-dim)';
		labelEl.textContent = label;
		const valueEl = document.createElement( 'span' );
		valueEl.style.fontWeight = '600';
		row.appendChild( labelEl );
		row.appendChild( valueEl );
		body.appendChild( row );
		return valueEl;

	}

	// data: { treasury, cityAllocation, spend: Map<category, amount> }
	// Updates regardless of open/closed state - not just while visible -
	// so the panel already reflects the latest tick's data the instant a
	// player opens it, rather than showing stale/blank content until the
	// next tick's update() call happens to land after open(). Only guards
	// on init() actually having run (lazy, on first open()), since the
	// DOM rows don't exist before that.
	update ( data ) {

		if ( ! this.treasuryRow ) return;

		this.treasuryRow.textContent = `$${ Math.round( data.treasury ).toLocaleString() }`;
		this.allocationRow.textContent = data.cityAllocation === null ? '—' : `$${ Math.round( data.cityAllocation ).toLocaleString() }`;

		this.spendList.innerHTML = '';
		if ( data.spend && data.spend.size > 0 ) {

			for ( const [ category, amount ] of data.spend ) {

				const row = document.createElement( 'div' );
				row.style.cssText = 'display:flex; justify-content:space-between; gap:14px; font-size:11px; color:var(--c-text-dim);';
				const labelEl = document.createElement( 'span' );
				labelEl.textContent = category;
				const valueEl = document.createElement( 'span' );
				valueEl.textContent = `$${ Math.round( amount ).toLocaleString() }`;
				row.appendChild( labelEl );
				row.appendChild( valueEl );
				this.spendList.appendChild( row );

			}

		} else {

			const none = document.createElement( 'div' );
			none.style.cssText = 'font-size:11px; color:var(--c-text-dim); font-style:italic;';
			none.textContent = 'Nothing built yet.';
			this.spendList.appendChild( none );

		}

	}

}
