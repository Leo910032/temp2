import Form from "./elements/LandingPage Elements/Form";
import Topings from "./elements/LandingPage Elements/Topings";
import LandingNav from "./components/General Components/LandingNav";

export default async function Home() {
    return (
        <main className="relative min-h-screen w-full overflow-x-hidden">
            {/* Animated mesh gradient background */}
            <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black">
                <div className="absolute inset-0 bg-gradient-mesh opacity-30 animate-mesh-gradient" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(58,224,154,0.1),transparent_50%)]" />
            </div>

            {/* Floating decorative shapes */}
            <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
                <div className="absolute top-20 left-10 w-64 h-64 bg-themeGreen/10 rounded-full blur-3xl animate-float" />
                <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-slow" />
                <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-float" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col min-h-screen">
                <LandingNav />
                <div className="flex-1 flex items-start justify-center py-8">
                    <Form />
                </div>
            </div>

            <Topings />
        </main>
    )
}