import SignUpForm from "./componets/SignupForm"
import { Toaster } from "react-hot-toast"

export const generateMetadata = () => {
    return {
        title: "Tapit | Créer un compte",
        description: "Créez votre compte Tapit et commencez à partager votre profil professionnel"
    }
}

export default function SignupPage() {

    return (
        <div className="flex h-screen w-screen">
            <Toaster />
            <SignUpForm />
        </div>
    )
}