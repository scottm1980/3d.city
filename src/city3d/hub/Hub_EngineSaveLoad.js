import { Hub_Pannel } from './Hub_Pannel.js';

// Real save/load for src/engine - see engine/persistence/RegionSerializer.js
// for the actual serialization. This panel is display + click-capture
// only; the caller wires onSave/onLoad to do the real work, since actually
// persisting requires access to the live region/orchestrator the caller
// owns, not anything this panel holds itself (same separation the
// Ordinances/Disaster panels use for their engine-mutating buttons).
export class Hub_EngineSaveLoad extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'Save / Load', isRight );

		this.onSave = null; // () => string, returns a status message to display
		this.onLoad = null; // () => string, returns a status message to display

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:auto; display:flex; flex-direction:column; align-items:center; gap:6px;';
        this.pannel.appendChild( this.body );

        const saveBtn = this.hubMain.addButton( this.body, 'SAVE', [ 138, 26, 11 ], null );
        const loadBtn = this.hubMain.addButton( this.body, 'LOAD', [ 138, 26, 11 ], null );
        saveBtn.title = 'Save the current region to localStorage';
        loadBtn.title = 'Load the previously saved region';

        saveBtn.addEventListener( 'click', ( e ) => {

            e.preventDefault();
            if ( this.onSave ) this.status.textContent = this.onSave();

        }, false );

        loadBtn.addEventListener( 'click', ( e ) => {

            e.preventDefault();
            if ( this.onLoad ) this.status.textContent = this.onLoad();

        }, false );

        this.status = document.createElement('div');
        this.status.style.cssText = 'font-size:11px; color:rgba(180,210,240,0.7); text-align:center; margin-top:4px;';
        this.body.appendChild( this.status );

	}

}
