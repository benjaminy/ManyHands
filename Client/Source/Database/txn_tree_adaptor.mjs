#!/usr/bin/env node --experimental-modules

import assert  from "../Utilities/assert.mjs";
import * as ST from "../Storage/tree.mjs";
import * as SC from "../Storage/common.mjs";
import binTree from "./Tree/binary.mjs";
import T from "transit-js";


export async function tree_adaptor_wrapper(storage){
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );

    return async function init_tree_adaptor(initial_data=[]){

        const storageTree = binTree(storage, initial_data);

        const ds = {};
        let data = [];


        if(Array.isArray(initial_data)){
            data = initial_data;
        }

        const avet = doSort(data, ATTRIBUTE, VALUE, ENTITY);
        const eavt = doSort(data, ENTITY, ATTRIBUTE, VALUE);
        const aevt = doSort(data, ATTRIBUTE, ENTITY, VALUE);
        const vaet = doSort(data, VALUE, ATTRIBUTE, ENTITY);

        root = await ST.openRoot("root", storage, options);

        root = ST.setValue( root, "avet", avet );
        root = ST.setValue( root, "eavt", eavt );
        root = ST.setValue( root, "aevt", aevt );
        root = ST.setValue( root, "vaet", vaet );

        root = await ST.writeTree( root ); // a promise

        ds.add = async (...datoms) => {
            const t_datoms = [];
            for (let i = 0; i < datoms.length; i++) {
                const datom = datoms[i];
                assert('entity' in datom
                    && 'attribute' in datom
                    && 'value' in datom);
                const t_datom = [
                    datom["entity"],
                    datom["attribute"],
                    datom["value"],
                    (new Date).getTime(),
                    false
                ];
                t_datoms.push(t_datom);
            }
            return await init_tree_adaptor([...data, ...t_datoms]);
        };

        ds.find = async (query) => {
            storageTree.query(query);
        };
        return ds;
    }


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
        for(let sort of sorts){
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
