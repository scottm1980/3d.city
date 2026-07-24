import { Hub_Pannel } from './Hub_Pannel.js';

// Real per-city policy toggles - see engine/tools/OrdinanceTool.js for
// the actual budget/trade effects. This panel is display + click-capture
// only; the caller wires onToggle to actually flip the engine state (same
// separation the original Hub_Ordinances.js keeps from AppState.main).
//
// Rows are built ONCE in init() and updated in place, not torn down and
// rebuilt on every update() call - the caller refreshes this panel every
// tick (~150ms) while it's open, and rebuilding the whole row list that
// often raced a real mouse click against a detached element the row's
// listener was still bound to (found via actual Playwright interaction,
// not code review - see RENDERER_INTEGRATION_FINDINGS.md).
export class Hub_EngineOrdinances extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'Ordinances', isRight );

		this.onToggle = null; // (ordinanceId) => void, set externally
		this.rowsById = new Map(); // ordinanceId -> { row, toggle, info }

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:auto;';
        this.pannel.appendChild( this.body );

	}

	update ( ordinances ) {

		if ( ! this.body ) return;
		if ( ! Array.isArray( ordinances ) ) return;

		for ( const ord of ordinances ) {

			let entry = this.rowsById.get( ord.id );
			if ( ! entry ) { entry = this._buildRow( ord ); this.rowsById.set( ord.id, entry ); }
			this._applyState( entry, ord );

		}

	}

	_buildRow ( ord ) {

		const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; cursor:pointer;'
                          + ' padding:8px; border-radius:6px; border:1px solid rgba(100,160,220,0.2);';

        const toggle = document.createElement('div');
        toggle.style.cssText = 'flex-shrink:0; width:16px; height:16px; border-radius:3px; margin-top:2px;';
        row.appendChild( toggle );

        const info = document.createElement('div');
        info.innerHTML = '<div style="font-size:13px; font-weight:600; color:#dce8f5;">' + ord.name + '</div>'
                       + '<div style="font-size:11px; color:rgba(180,210,240,0.6); line-height:1.4;">' + ord.description + '</div>';
        row.appendChild( info );

        row.addEventListener( 'click', ( e ) => { e.preventDefault(); if ( this.onToggle ) this.onToggle( ord.id ); }, false );

        this.body.appendChild( row );

        return { row, toggle };

	}

	_applyState ( entry, ord ) {

		entry.row.style.background = ord.active ? 'rgba(75,204,122,0.12)' : 'rgba(255,255,255,0.03)';
        entry.toggle.style.border = '1.5px solid ' + ( ord.active ? '#4bcc7a' : 'rgba(100,160,220,0.4)' );
        entry.toggle.style.background = ord.active ? '#4bcc7a' : 'transparent';

	}

}
