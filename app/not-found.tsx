import Image from "next/image";
import SideThing from "./components/General Components/SideThing";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen">
      <div className="flex-1 flex flex-col sm:p-12 py-8 p-2 relative">
        <Link href={'/'} className="sm:p-0 p-3 w-fit relative z-20">
          <Image priority src={"https://linktree.sirv.com/Images/full-logo.svg"} alt="logo" height={150} width={100} className="w-[7.05rem]" />
        </Link>
        <div className="flex-1 flex items-center flex-col relative z-20 justify-center px-10">
          <div className="grid place-items-center">
            <Image
              src={"https://linktree.sirv.com/Images/svg%20element/404%20error%20lost%20in%20space-bro.svg"}
              alt="under contruction"
              height={3780}
              width={3980}
              className="h-fit sm:max-w-[22rem] max-w-[80%] object-contain"
            />
          </div>
          <h1 className="text-themeGreen md:text-4xl sm:text-3xl text-2xl text-center font-semibold">Uh oh. Page not found</h1>
          <p className="sm:text-lg opacity-60 my-2 text-center">Sorry, the page you were looking for doesn&apos;t exist or has been hidden.</p>
        </div>
        <Image
          src={"https://linktree.sirv.com/Images/404-bg.jpg"}
          alt="404 bg patterns"
          height={612}
          width={612}
          className="absolute top-0 right-0 h-screen w-screen object-cover opacity-5 blur-sm"
        />
      </div>
      <SideThing />
    </div>
  );
}