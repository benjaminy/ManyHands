import {user, generate_dh_keypair, generate_dsa_keypair, sign_key, triple_diffie_hellman, verify_key_signature, derive_shared_secret} from "./user_class";
import WebCrypto from "node-webcrypto-ossl";

const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    console.log("im a real boy!");
    let bob = await user();
    let alice = await user();
    let shared_secret = await triple_diffie_hellman(alice, bob);
    console.log(shared_secret);
}

main();
