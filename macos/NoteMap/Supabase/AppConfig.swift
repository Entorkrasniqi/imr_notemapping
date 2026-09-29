import Foundation

/// Build-time configuration, read from the Info.plist keys that
/// `Config/Info.plist` fills in from `Config/Supabase.xcconfig`.
struct AppConfig {
    let supabaseURL: URL
    let supabaseAnonKey: String
    /// The deployed web app, opened in the browser for billing. `nil` hides
    /// the billing buttons (see Supabase.example.xcconfig for why billing
    /// isn't done natively).
    let webAppURL: URL?

    static func load(from bundle: Bundle = .main) -> AppConfig? {
        func value(_ key: String) -> String? {
            let raw = (bundle.object(forInfoDictionaryKey: key) as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            // An unset build setting expands to "", and a placeholder left
            // over from the example file is just as unusable.
            guard let raw, !raw.isEmpty, !raw.contains("$("), !raw.contains("your-") else { return nil }
            return raw
        }

        guard
            let urlString = value("NoteMapSupabaseURL"),
            let url = URL(string: urlString),
            url.scheme == "https" || url.scheme == "http",
            let anonKey = value("NoteMapSupabaseAnonKey")
        else { return nil }

        let webAppURL = value("NoteMapWebURL").flatMap(URL.init(string:))
        return AppConfig(supabaseURL: url, supabaseAnonKey: anonKey, webAppURL: webAppURL)
    }
}
