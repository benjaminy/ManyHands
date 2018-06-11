import {user} from "./user";
import {line_beak, named_beak} from "./debug_helpers";
import {x3dh_sender} from "./extended_triple_diffie_hellman"
import {generate_sender_key_bundle} from "./extended_triple_diffie_hellman"

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    let alice = await user("alice");
    let bob = await user("bob");

    let key_bundle = generate_sender_key_bundle(alice, bob);
    let shared_secret = await x3dh_sender(key_bundle);

    named_beak("shared_secret");
    console.log(shared_secret)

}

main();
