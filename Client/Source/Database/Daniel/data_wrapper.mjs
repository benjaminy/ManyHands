/* An interface which should be extended by data structures */

import * as K from '../../Utilities/keyword.mjs';
import assert  from "../../Utilities/assert";


function init(){
    const dataStructure = {};

    dataStructure.add = (datom) => {};
    dataStructure.revoke = (datom) => {};
    dataStructure.findByEntity = (entity) => {}; // returns a list of datoms
    dataStructure.findByAttribute = (attribute) => {}; // returns a list of datoms
    dataStructure.findByValue = (key) => {}; // returns a list of datoms
}

export function init_simple_dict(){
    const ds = {};
    const data = [];

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

    ds.add = (datom) => {
        datom.timestamp = (new Date).getTime();
        datom.revoked = false;
        assert('entity' in datom
            && 'attribute' in datom
            && 'value' in datom);
        data.push(datom);
        return datom;
    };
    ds.revoke = (datom) => {
        for(let i = 0; i < data.length; i++){
            if(compareDatom(datom, data[i])) {
                datom.revoked = true;
            }
        }
    };
    ds.findByAttribute = (attribute) => {
        const found = [];
        for(let i = 0; i < data.length; i++){
            if(K.compare(attribute, data[i].attribute) === 0){
                found.push(data[i]);
            }
        }
        return found;
    };
    ds.findByValue = (value) => {
        const found = [];
        for(let i = 0; i < data.length; i++){
            if(data[i].value === value){
                found.push(data[i]);
            }
        }
        return found;
    };
    ds.findByEntity = (entity) => {
        const found = [];
        for(let i = 0; i < data.length; i++){
            if(data[i].entity === entity){
                found.push(data[i]);
            }
        }
        return found;
    };
    return ds;
}

export function compareDatom(d1, d2){
    return d1.entity === d2.entity  // primitive number
        && (K.compare(d1.attribute, d2.attribute) === 0)  // key
        && d1.value === d2.value    // TODO transit number
}