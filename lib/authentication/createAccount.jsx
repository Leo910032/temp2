import { fireApp } from "@/important/firebase";
import { generateId, realEscapeString} from "../utilities";
import { collection, doc, setDoc } from "firebase/firestore";
import { generateSalt, hashPassword } from "./encryption";
import { EmailService } from "../services/server/emailService";
import Error from "next/error";


export const createAccount = async (data) => {
    const { email, username, password } = data;
    const userId = generateId();
    const generatedUserId = userId;

    try {
        const accountRef = collection(fireApp, "accounts");
        const accountDetailsRef = collection(fireApp, "AccountData");

        const cleanUsername = realEscapeString(username);
        const cleanEmail = realEscapeString(email);
        const cleanPassword = realEscapeString(password);
        
        const salt = generateSalt();
        const hashedPasword = hashPassword(cleanPassword, salt);

        await EmailService.sendWelcomeEmail(
            cleanEmail,
            cleanUsername,
            cleanPassword
        ).catch((error) => {
            throw new Error(`${error}`);
        })


        await setDoc(doc(accountRef, `${userId}`), {
            userId: userId,
            email: cleanEmail,
            username: cleanUsername,
            password: hashedPasword,
            mySalt: salt,
        });

        await setDoc(doc(accountDetailsRef, `${userId}`), {
            displayName: cleanUsername,
            links: [],
            profilePhoto: "",
            selectedTheme: "Lake White",
        });

        return generatedUserId;

    } catch (error) {
        console.error(error)
        throw new Error(error);
    }
}