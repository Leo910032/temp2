import { Toaster } from "react-hot-toast"
import LoginForm from "./componets/LoginForm"

export const generateMetadata = () =>{
    return {
        title: "Tapit | Connexion",
        description: "Connectez-vous à votre compte Tapit"
    }
}

export default function LoginPage() {

    return (
        <div className="flex h-screen w-screen">
            <Toaster />
            <LoginForm />
        </div>
    )
}