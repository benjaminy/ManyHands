import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as diffie from "./triple_dh"

import assert from "assert";


const groups = {};

export async function create_new_team(name, group_members_pub) {
    const new_group = {};

    new_group[name] = [];

    // initializing global variable
    for (let i = 0; i < group_members_pub.length; i++) {
        new_group[name].push(group_members_pub[i].uid);
        group_members_pub[i].group_outboxes[name] = [];
        group_members_pub[i].groups.push(name);

        // initializing everyones outboxes
        const current_group_member = group_members_pub[i].uid;

        for (let j = 0; j < group_members_pub.length; j++) {
            if (i !=  j) {
                if (!(current_group_member in group_members_pub[j].user_outboxes)) {
                    group_members_pub[j].user_outboxes[current_group_member] = {};
                }
                group_members_pub[j].user_outboxes[current_group_member][name] = [];
            }
        }

    };

    Object.assign(groups, new_group);
    return new_group;
}

export async function upload_team_message(sender, group_index, message_to_send) {

    // identifying group name based off of the index passed to the function
    const group_name = sender.pub.groups[group_index];

    // Eventually this will turn into encrypting the message
    const buffer_to_send = await crypto.encode_string(message_to_send);

    // pushong the message to the group outbox
    sender.pub.group_outboxes[group_name].push(buffer_to_send);

    // generating a key for each group memeber to encrypt the group message with 
    for (let i = 0; i < groups[group_name].length; i++) {
        const current_group_member_name = groups[group_name][i];

        if (current_group_member_name !== sender.pub.uid) {
            sender.pub.user_outboxes[current_group_member_name][group_name].push(await crypto.random_secret());
        }
    }
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
