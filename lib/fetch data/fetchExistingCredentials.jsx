import { fireApp } from "@/important/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function fetchExistingCredentials() {
    const existingUsernames = [];
    const existingEmail = [];

    const collectionRef = collection(fireApp, "AccountData"); // Changed from "accounts" to "AccountData"

    return new Promise((resolve, reject) => {
        onSnapshot(collectionRef, (querySnapshot) => {
            querySnapshot.forEach((credential) => {
                const data = credential.data();
                const { email, username } = data;
                if (email) existingEmail.push(email);
                if (username) existingUsernames.push(username);
            });
            resolve([existingEmail, existingUsernames]);
        }, (error) => {
            reject(error);
        });
    });
}