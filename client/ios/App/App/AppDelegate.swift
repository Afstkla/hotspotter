import UIKit
import Capacitor
import NetworkExtension

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - WifiPlugin
// Phase-2 native "connect now". Joins a network via NEHotspotConfiguration.
// Requires the "Hotspot Configuration" capability (com.apple.developer.networking.HotspotConfiguration)
// enabled on the App ID in your Apple Developer account, and a real device (the simulator can't join WiFi).
// Capacitor auto-discovers this CAPBridgedPlugin conformer at runtime — no manual registration needed.
@objc(WifiPlugin)
public class WifiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WifiPlugin"
    public let jsName = "Wifi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canConnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise)
    ]

    @objc func canConnect(_ call: CAPPluginCall) {
        call.resolve(["value": true])
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let ssid = call.getString("ssid"), !ssid.isEmpty else {
            call.reject("ssid is required")
            return
        }
        let password = call.getString("password")

        let configuration: NEHotspotConfiguration
        if let password = password, !password.isEmpty {
            configuration = NEHotspotConfiguration(ssid: ssid, passphrase: password, isWEP: false)
        } else {
            configuration = NEHotspotConfiguration(ssid: ssid) // open network
        }
        configuration.joinOnce = false

        NEHotspotConfigurationManager.shared.apply(configuration) { error in
            if let error = error as NSError? {
                // "already associated" means we're effectively connected already.
                if error.domain == NEHotspotConfigurationErrorDomain,
                   error.code == NEHotspotConfigurationError.alreadyAssociated.rawValue {
                    call.resolve(["connected": true, "alreadyConnected": true])
                } else {
                    call.reject(error.localizedDescription, "\(error.code)", error)
                }
            } else {
                call.resolve(["connected": true])
            }
        }
    }
}
