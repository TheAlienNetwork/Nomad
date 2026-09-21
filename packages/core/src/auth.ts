export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Password must be at least 10 characters.");
  if (password.length > 200) issues.push("Password is too long.");
  if (!/[A-Za-z]/.test(password)) issues.push("Password must include a letter.");
  if (!/[0-9]/.test(password)) issues.push("Password must include a number.");
  return issues;
}

export function assertCredentials(email: string, password: string): string | undefined {
  if (!isValidEmail(email)) return "Enter a valid email address.";
  const issues = passwordIssues(password);
  return issues[0];
}
