import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.22_0.04_260)] via-[oklch(0.28_0.06_255)] to-[oklch(0.22_0.04_265)] relative overflow-hidden">
      {/* Decorative blur shapes */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[oklch(0.45_0.15_260_/_0.15)] blur-[120px]" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[oklch(0.50_0.18_240_/_0.12)] blur-[100px]" />
      <div className="absolute top-[30%] right-[20%] w-[250px] h-[250px] rounded-full bg-[oklch(0.55_0.12_280_/_0.08)] blur-[80px]" />
      <LoginForm />
    </main>
  );
}
