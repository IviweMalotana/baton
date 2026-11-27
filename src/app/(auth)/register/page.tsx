import { AuthBrand, RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const initialType = searchParams.type === "company" ? "company" : "ba";

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <AuthBrand />
        <RegisterForm initialType={initialType} />
      </div>
    </div>
  );
}
