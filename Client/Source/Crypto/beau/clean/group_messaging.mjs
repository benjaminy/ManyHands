import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"

import assert from "assert";


const groups = {};

export async function create_new_group(name, group_members_pub) {
    const new_group = {};

    new_group[name] = [];
    for (let i = 0; i < group_members_pub.length; i++) {
        new_group[name].push(group_members_pub[i]);
        group_members_pub[i].group_outboxes[name] = [];

        const current_group_member = group_members_pub[i].uid;

        for (let j = 0; j < group_members_pub.length; j++) {
            if (i !=  j) {
                group_members_pub[j].user_outboxes[current_group_member] = [];
            }
        }

    };

    Object.assign(groups, new_group);
    return new_group;
}

/*
upload_group_message() {
    this function will ceate a message that is encrypted with a new key k,
    then this funciton fill call upload user message with every other member in the group
}

download_group_message() {
    this function will download all messages from each of the members of the group
    by calling download_message from the messaging module.
}




*/
