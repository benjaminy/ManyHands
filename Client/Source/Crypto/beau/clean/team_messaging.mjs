import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as user_messaging from "./user_messaging"
import * as diffie from "./triple_dh"

import assert from "assert";

const groups = {};

export async function create_new_team(group_name, group_members) {
    const new_group = {};

    new_group[group_name] = [];

    // initializing curr memebrs pub and priv group variables
    // need to initialize the members with a triple diffie hellman too.

    for (let i = 0; i < group_members.length; i++) {
        const curr_member = group_members[i];
        const pub1 = curr_member.pub;
        const priv1 = curr_member.priv;

        new_group[group_name].push(pub1.uid);

        pub1.teams[group_name] = {};
        pub1.teams[group_name].outbox = [];

        priv1.teams[group_name] = {};
        priv1.teams[group_name].timestamp = {};
        priv1.teams[group_name].members = [];
        priv1.teams[group_name].log = [];

        pub1.users[group_name] = {};
        // priv1.users[group_name] = {};


        for (let j = 0; j < group_members.length; j++) {
            if (i != j) {
                const other_member = group_members[j]
                const pub2 = other_member.pub;
                const priv2 = other_member.priv;

                pub1.users[group_name][pub2.uid] = {};
                pub1.users[group_name][pub2.uid].outbox = [];

                priv1.teams[group_name].members.push(pub2);
                // need to do a tiple diffie hellman with them to fill the conversation keys


                if (i < j) {
                    const sender_diffie_out = await diffie.sender_triple_diffie_hellman(priv1, pub2);
                    const sender_shared_secret = sender_diffie_out.shared_secret;
                    const sender_ephemeral_key = sender_diffie_out.ephemeral_public_key;

                    const new_key = await crypto.generate_dh_key();

                    // Sender conversation gets initialized
                    const sender_conversation = await user.init_conversation_keys(sender_shared_secret);

                    // Sender recieve key gets set to the reciever prekey
                    sender_conversation.recieve_key = pub2.prekey;

                    // Sender Send key gets set to the newly generated dh_key
                    sender_conversation.send_key.publicKey = new_key.publicKey;
                    sender_conversation.send_key.privateKey = new_key.privateKey;

                    if (!(group_name in priv1.users)) {
                        priv1.users[group_name] = {};
                    }
                    priv1.users[group_name][pub2.uid] = {};
                    priv1.users[group_name][pub2.uid].conversation = sender_conversation;


                    // Reciever conversation gets intialized
                    const reciever_shared_secret = await diffie.reciever_triple_diffie_hellman(
                        pub1.id_dh, sender_ephemeral_key, priv2
                    );
                    const reciever_conversation = await user.init_conversation_keys(reciever_shared_secret);

                    // Reciever send key is set to their prekey
                    reciever_conversation.send_key.publicKey = pub2.prekey;
                    reciever_conversation.send_key.privateKey = priv2.prekey;

                    // Reciever recieve key is set to the newly generated key
                    reciever_conversation.recieve_key = new_key.publicKey;

                    if (!(group_name in priv2.users)) {
                        priv2.users[group_name] = {};
                    }
                    priv2.users[group_name][pub1.uid] = {};
                    priv2.users[group_name][pub1.uid].conversation = reciever_conversation;

                    assert(new Uint32Array(sender_shared_secret)[0] === new Uint32Array(reciever_shared_secret)[0]);

                }
            }
        }
    };

    Object.assign(groups, new_group);
    return new_group;
}

export async function upload_team_message(sender, group_name, message_to_send) {
    const buffer_to_send = await crypto.encode_string(message_to_send);

    sender.pub.teams[group_name].outbox.push(buffer_to_send);

    const team_members = sender.priv.teams[group_name].members;

    for (let i = 0; i < team_members.length; i++) {
        const current_group_member_name = team_members[i].uid;
        const random_key = await crypto.random_secret();
        const sender_conversation = sender.priv.users[group_name][current_group_member_name].conversation
        console.log("first number of random key from send");
        console.log(new Uint8Array(random_key)[0]);
        const garbage_message = await user_messaging.create_user_message(sender_conversation, random_key);

        sender.pub.users[group_name][current_group_member_name].outbox.push(garbage_message);
    }
}

export async function download_team_messages(reciever, group_name) {
    const team_members = reciever.priv.teams[group_name].members;

    // loop for each team member
    for (let i = 0; i < team_members.length; i++) {
        const sender_pub = team_members[i];

        // loop for each message from a team member
        const new_messages = sender_pub.users[group_name][reciever.pub.uid].outbox;
        console.log("length of new messages array in reciever");
        console.log(new_messages.length);
        for (let j = 0; j < new_messages.length; j++) {
            const current_message = new_messages.shift();
            const message = await user_messaging.parse_user_message(
                reciever.priv.users[group_name][sender_pub.uid].conversation, current_message
            );

            console.log("first number of random key from recieve");
            console.log(new Uint8Array(message)[0]);

        }
    }
}
