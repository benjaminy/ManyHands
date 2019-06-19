/* An interface which should be extended by data structures */

import * as K from "../../Utilities/keyword.mjs";
import assert  from "../../Utilities/assert.mjs";
import T from "transit-js";

export function init_simple_dict(initial_data=false){
    const ds = {};
    const data = initial_data || [];

    let avet;
    let eavt;
    let aevt;
    let vaet;

    function populate_lists(){
        avet = doSort(data, 'attribute', 'value', 'entity');
        eavt = doSort(data, 'entity', 'attribute', 'value');
        aevt = doSort(data, 'attribute', 'entity', 'value');
        vaet = doSort(data, 'value', 'attribute', 'entity');
    }

    populate_lists();

    // datom must be in the form:
    /*
    {
       entity: id,
       attribute: K.key(':attr'),
       value: Transit data "primitive",
       timestamp: TODO,
       revoked: boolean
    }
    */

    ds.add = (...datoms) => {
        for(let i = 0; i < datoms.length; i++) {
            const datom = datoms[i];
            datom.timestamp = (new Date).getTime();
            datom.revoked = false;
            assert('entity' in datom
                && 'attribute' in datom
                && 'value' in datom);
        }
        return init_simple_dict([...data, ...datoms]);
    };
    /*ds.revoke = (datom) => { // TODO spread operator
        for(let i = 0; i < data.length; i++) {
            if (compareDatom(datom, data[i])) {
                datom.revoked = true;
            }
        }
    };*/

    ds.find = (options) => {
        const {entity, attribute, value} = typeof(options) === 'object' ? options : {};
        if(entity === undefined && attribute === undefined && value === undefined){
            // doesn't matter what we use
            return [...data];
        }
        if(entity === undefined && attribute === undefined && value !== undefined){
            // VAET
            return sortedSearch(vaet, 'value', value);
        }
        if(entity === undefined && attribute !== undefined && value === undefined){
            // AVET or AEVT
            return sortedSearch(aevt, 'attribute', attribute);
        }
        if(entity === undefined && attribute !== undefined && value !== undefined){
            // AVET or VAET
            const vet = sortedSearch(avet, 'attribute', attribute);
            return sortedSearch(vet, 'value', value);
        }
        if(entity !== undefined){
            // EAVT is the only index with an entity in it
            const avt = sortedSearch(eavt, 'entity', entity);
            if(attribute !== undefined){
                const vt = sortedSearch(avt, 'attribute', attribute);
                if(value !== undefined){
                    return sortedSearch(vt, 'value', value);
                }
                return vt;
            }
            if(value !== undefined){ // TODO do we want an index for this particular case?
                return unsortedSearch(avt, 'value', value);
            }
            return avt;
        }
    };
    return ds;
}


export function compareDatom(d1, d2){
    return d1.entity === d2.entity  // primitive number
        && (K.compare(d1.attribute, d2.attribute) === 0)  // key
        && d1.value === d2.value    // TODO transit number
}


/**
 *
 * Populate one of our data map "indices" with data-- we just sort the list and then
 *
 * @param data The data we'd like to insert into this map
 * @param sorts The order of how we're sorting-- strings which refer to datom attributes
 */
function doSort(data, ...sorts){
    data.sort((self, other) => {
        for(let sort of sorts) {
            let ix;
            /*if (sort === 'attribute') { // TODO attribute will be a number
                //ix = K.compare(self[sort], other[sort]);
                //ix = self[sort] - other[sort];
                ix = K.compare()
            } else */if (typeof (self[sort]) === "number" && "number" === typeof (other[sort])) {
                ix = self[sort] - other[sort];
            } else if (typeof (self[sort]) === "string" && "string" === typeof (other[sort])) {
                ix = self[sort].localeCompare(other[sort].toString());
            } else if (self[sort] === null && null === other[sort]) {
                return 0;
            } else if (self[sort] === null) {
                return 1;
            } else if (other[sort] === null) {
                return -1
            } else {
                // TODO this is a bad catch-all
                ix = self[sort].toString().localeCompare(other[sort].toString());
                /*
                throw new Error("Unimplemented");
                */
            }
            if(ix !== 0){
                return ix;
            }
        }
        return 0;
    });
    return [...data];
}

/**
 * Search a list, assuming it is sorted by a particular field.
 *
 * @param list the list you are searching, and assuming to be sorted by `field`
 * @param field the field you are searching by
 * @param value the value of this field
 */
function sortedSearch(list, field, value){
    return unsortedSearch(list, field, value); // sorry Mom
    // TODO this can, and should, be O(log(n))
}

/**
 * Search a list, assuming nothing about the order of the list, by `field`, searching for `value`
 * @param list
 * @param field
 * @param value
 */
function unsortedSearch(list, field, value){
    const results = [];
    for(let record of list){
        if(T.equals(record[field], value)){
            results.push(record);
        }
    }
    return results;
}
