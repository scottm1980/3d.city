import { Hub_Pannel } from './Hub_Pannel.js';

// Real, traceable trade disruptions - see engine/tools/DisruptionTool.js.
// Trigger buttons call back out to the caller (which picks a real facility
// or corridor and calls DisruptionTool itself); this panel only displays
// whatever activeDisruptions() currently reports.
export class Hub_EngineDisaster extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'Disaster', isRight );

		this.onDisruptFacility = null; // () => void, set externally
		this.onDisruptCorridor = null; // () => void, set externally

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:auto;';
        this.pannel.appendChild( this.body );

		const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:6px; margin-bottom:10px;';
        this.body.appendChild( btnRow );

        const facilityBtn = this.hubMain.addButton( btnRow, 'Supply Shock', [ 100, 28, 11 ], null );
        const corridorBtn = this.hubMain.addButton( btnRow, 'Sever Route', [ 100, 28, 11 ], null );
        facilityBtn.title = 'Stop a random active facility from producing for a while';
        corridorBtn.title = 'Cut a random corridor\'s capacity for a while';

        facilityBtn.addEventListener( 'click', ( e ) => { e.preventDefault(); if ( this.onDisruptFacility ) this.onDisruptFacility(); }, false );
        corridorBtn.addEventListener( 'click', ( e ) => { e.preventDefault(); if ( this.onDisruptCorridor ) this.onDisruptCorridor(); }, false );

        this.list = document.createElement('div');
        this.list.style.cssText = 'font-size:11px; color:rgba(180,210,240,0.7);';
        this.body.appendChild( this.list );

	}

	update ( active ) {

		if ( ! this.list ) return;
		if ( ! active ) return;

		const total = active.facilities.length + active.corridors.length;

        if ( total === 0 ) {

			this.list.innerHTML = '<div style="color:rgba(180,210,240,0.5);">No active disruptions.</div>';
			return;

        }

        let html = '';
        for ( const { facility, city, ticksRemaining } of active.facilities ) {

			html += '<div style="padding:4px 6px; margin-bottom:4px; border-radius:4px; background:rgba(224,85,85,0.15);'
                  + ' border:1px solid rgba(224,85,85,0.4);">⚠ ' + facility.archetypeId + ' in ' + city.name
                  + ' stalled - ' + ticksRemaining + ' ticks left</div>';

        }

        for ( const { corridor, ticksRemaining } of active.corridors ) {

			html += '<div style="padding:4px 6px; margin-bottom:4px; border-radius:4px; background:rgba(224,85,85,0.15);'
                  + ' border:1px solid rgba(224,85,85,0.4);">⚠ Route ' + corridor.id
                  + ' severed - ' + ticksRemaining + ' ticks left</div>';

        }

        this.list.innerHTML = html;

	}

}
