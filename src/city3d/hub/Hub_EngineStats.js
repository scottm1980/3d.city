import { AppState } from '../../AppState.js'

//------------------------------------------------------//
//         ENGINE-NATIVE STATS PANEL (src/engine)        //
//------------------------------------------------------//
// A real Hub panel, structurally alongside Hub_Top/Hub_Budget/Hub_Eval,
// but deliberately NOT a replacement for them in place - those files are
// still what the shipping game (still running on GPL src/micro via
// CityGame.js) actually uses today, and editing them in place would
// change what the current game displays before the engine is actually
// driving it. This is new, additive UI for what src/engine actually
// models - national treasury + city allocation, control mode, facility
// mix, trade activity - instead of Micropolis' population/RCI-valve/
// crime/pollution/happiness/tax-rate/bond dashboard, which src/engine
// has no equivalent for and was never designed to have (see
// RENDERER_INTEGRATION_FINDINGS.md's cutover-research section). Reuses
// the same --c-*/--font-ui CSS custom properties every other Hub panel
// uses, so it reads as part of the same UI language, not a bolted-on
// debug overlay.
export class Hub_EngineStats {

	constructor ( hub ) {

		const target = hub.hub;

		this.content = document.createElement( 'div' );
		this.content.style.cssText = 'position:absolute; top:0px; left:0; width:100%; height:200px; pointer-events:none; background:none; transform: scale(0.66); transform-origin: top left;';
		target.appendChild( this.content );

		this.inner = document.createElement( 'div' );
		this.inner.style.cssText = 'position:absolute; top:0px; left:0px; border:4px solid var(--c-border); border-radius:0 0 20px 0; border-top:none; border-left:none; width:420px; pointer-events:none; background:var(--c-surface-alt); box-sizing:content-box; box-shadow:var(--shadow-hub); padding:10px 16px 12px;';
		this.content.appendChild( this.inner );

		this.title = this._row( '', '', true );
		this.controlMode = this._row( 'Control', '' );
		this.treasury = this._row( 'National treasury', '' );
		this.allocation = this._row( 'City funds', '' );
		this.facilities = this._row( 'Facilities', '' );
		this.trade = this._row( 'Trade', '' );

	}

	_row ( label, value, isTitle ) {

		const row = document.createElement( 'div' );
		row.style.cssText = isTitle
			? 'font-size:16px; font-weight:700; color:var(--c-text); margin-bottom:6px;'
			: 'display:flex; justify-content:space-between; gap:16px; font-size:12px; color:var(--c-text-dim); margin-bottom:3px;';
		this.inner.appendChild( row );

		if ( isTitle ) {

			row.textContent = label;
			return row;

		}

		const labelEl = document.createElement( 'span' );
		labelEl.textContent = label;
		row.appendChild( labelEl );

		const valueEl = document.createElement( 'span' );
		valueEl.style.cssText = 'color:var(--c-text); font-weight:600;';
		valueEl.textContent = value;
		row.appendChild( valueEl );

		return valueEl;

	}

	// data: { title, controlMode, treasury, cityAllocation, facilityCounts:
	// {residential,commercial,industrial}, activeShipments, shipmentsDelivered }
	update ( data ) {

		this.title.textContent = data.title;
		this.controlMode.textContent = data.controlMode;
		this.controlMode.style.color = data.controlMode === 'MANAGED' ? 'var(--c-accent-hi)' : 'var(--c-success)';
		this.treasury.textContent = `$${ Math.round( data.treasury ).toLocaleString() }`;
		this.allocation.textContent = data.cityAllocation === null ? '—' : `$${ Math.round( data.cityAllocation ).toLocaleString() }`;
		this.facilities.textContent = `${ data.facilityCounts.residential } R / ${ data.facilityCounts.commercial } C / ${ data.facilityCounts.industrial } I`;
		this.trade.textContent = `${ data.activeShipments } in transit, ${ data.shipmentsDelivered } delivered`;

		// Hub_Build's RCI bar is genuinely engine-agnostic (three raw
		// counts, no Micropolis-specific assumption baked in) - reused
		// as-is rather than rebuilt, the one piece of the existing Hub
		// that needs no redesign at all.
		if ( AppState.hub && AppState.hub.buildHub ) {

			AppState.hub.updateRCI( data.facilityCounts.residential, data.facilityCounts.commercial, data.facilityCounts.industrial );

		}

	}

}
