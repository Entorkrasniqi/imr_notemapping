import SwiftUI

/// Log in / sign up — `app/login/page.tsx` and `app/signup/page.tsx`.
struct AuthView: View {
    enum Mode { case login, signup }

    let mode: Mode
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var themeStore: ThemeStore

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var info: String?
    @State private var isSubmitting = false
    @FocusState private var emailFocused: Bool

    private var isLogin: Bool { mode == .login }

    var body: some View {
        let palette = themeStore.theme.palette
        ZStack {
            PageBackground(palette: palette)
            VStack(spacing: 12) {
                LogoMark(size: 40)
                    .padding(.bottom, 6)
                Text(isLogin ? "Log in to ScriptumOS" : "Create your ScriptumOS account")
                    .font(themeStore.theme == .blueprint
                          ? .system(size: 17, weight: .semibold, design: .monospaced)
                          : .system(size: 17, weight: .semibold))
                    .foregroundColor(palette.textPrimary.swiftUI)
                    .padding(.bottom, 12)

                AuthField(placeholder: "Email", text: $email, isSecure: false, palette: palette)
                    .textContentType(.username)
                    .focused($emailFocused)
                AuthField(placeholder: isLogin ? "Password" : "Password (8+ characters)", text: $password,
                          isSecure: true, palette: palette)
                    .textContentType(.password)

                if let error {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundColor(palette.errorText.swiftUI)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let info {
                    Text(info)
                        .font(.system(size: 13))
                        .foregroundColor(palette.textSecondary.swiftUI)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    submit()
                } label: {
                    Text(buttonTitle).frame(maxWidth: .infinity)
                }
                .buttonStyle(.pill(.primary, palette))
                .keyboardShortcut(.defaultAction)
                .disabled(isSubmitting || email.isEmpty || password.isEmpty)
                .padding(.top, 4)

                HStack(spacing: 4) {
                    Text(isLogin ? "Don't have an account?" : "Already have an account?")
                        .foregroundColor(palette.textSecondary.swiftUI)
                    Button(isLogin ? "Sign up" : "Log in") {
                        isLogin ? appModel.showSignup() : appModel.showLogin()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(palette.textPrimary.swiftUI)
                    .underline()
                }
                .font(.system(size: 13))
                .padding(.top, 8)
            }
            .frame(width: 320)
        }
        .navigationTitle("ScriptumOS")
        .onAppear { emailFocused = true }
    }

    private var buttonTitle: String {
        if isSubmitting { return isLogin ? "Logging in…" : "Creating account…" }
        return isLogin ? "Log in" : "Sign up"
    }

    private func submit() {
        guard !isSubmitting, !email.isEmpty, !password.isEmpty else { return }
        if !isLogin && password.count < 8 {
            error = "Password should be at least 8 characters."
            return
        }
        error = nil
        info = nil
        isSubmitting = true
        Task {
            do {
                if isLogin {
                    try await appModel.signIn(email: email, password: password)
                } else if try await !appModel.signUp(email: email, password: password) {
                    info = "Account created — check your email to confirm it, then log in."
                }
            } catch {
                self.error = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}

private struct AuthField: View {
    let placeholder: String
    @Binding var text: String
    let isSecure: Bool
    let palette: ThemePalette

    var body: some View {
        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .textFieldStyle(.plain)
        .font(.system(size: 13))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(palette.inputBackground.swiftUI))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.inputBorder.swiftUI, lineWidth: 1))
    }
}
