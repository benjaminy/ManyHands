#!/usr/bin/env node --experimental-modules

import assert  from "../Utilities/assert.mjs";
import * as ST from "../Storage/tree.mjs";
import * as SC from "../Storage/common.mjs";
import * as TR from "./Tree/binary.mjs";
import T from "transit-js";


export async function initialize_tree_adaptor( initial_data=[] ){
    let data = [];
    if(Array.isArray(initial_data)){
        data = initial_data;
    }

    console.log("initiaiotaldsf", data)

    const storageTree = await TR.buildTree( data );
    return tree_adaptor( storageTree )
}

export function tree_adaptor( storageTree ){
    const ds = {};

    const engine = TR.wrapTree( storageTree );
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
        // TODO query for all?
        console.log("rebuilding the tree");
        console.log("BLANK QUERY", await engine.query({}));
        return await initialize_tree_adaptor([...( await engine.query({}) ), ...t_datoms]);
    };

    ds.find = async (query) => {
        console.log("QUERYING:", query, await engine.query(query));
        return await engine.query(query);
    };

    ds.node = storageTree;

    return ds;
}

