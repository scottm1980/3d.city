export const ResourceCategory = Object.freeze( {
    RAW: 'raw',
    PROCESSED: 'processed',
} );

export class ResourceType {

    constructor ( id, name, category, unit = 'unit' ) {

        this.id = id;
        this.name = name;
        this.category = category;
        this.unit = unit;

    }

    get isRaw () { return this.category === ResourceCategory.RAW; }
    get isProcessed () { return this.category === ResourceCategory.PROCESSED; }

}

export class ResourceRegistry {

    constructor () {

        this._types = new Map();

    }

    register ( resourceType ) {

        this._types.set( resourceType.id, resourceType );
        return resourceType;

    }

    get ( id ) {

        return this._types.get( id ) || null;

    }

    all () {

        return Array.from( this._types.values() );

    }

}
