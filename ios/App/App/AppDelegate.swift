import UIKit
import Capacitor

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

public class NextJSRouter: Router {
    public init() {}
    public var basePath: String = ""

    public func route(for path: String) -> String {
        let fileManager = FileManager.default
        let cleanPath = (path.hasSuffix("/") && path.count > 1) ? String(path.dropLast()) : path

        // 1. Direct file match (e.g. /_next/static/..., /favicon.ico, etc.)
        let exactPath = basePath + path
        var isDir: ObjCBool = false
        if fileManager.fileExists(atPath: exactPath, isDirectory: &isDir), !isDir.boolValue {
            NSLog("[NextJSRouter] DIRECT: %@ -> %@", path, exactPath)
            return exactPath
        }

        // 2. Directory with index.html (e.g. /gate -> /gate/index.html)
        let dirIndexPath = basePath + cleanPath + "/index.html"
        if fileManager.fileExists(atPath: dirIndexPath) {
            NSLog("[NextJSRouter] DIR INDEX: %@ -> %@", path, dirIndexPath)
            return dirIndexPath
        }

        // 3. Static .html file (e.g. /gate -> /gate.html)
        let htmlPath = basePath + cleanPath + ".html"
        if fileManager.fileExists(atPath: htmlPath) {
            NSLog("[NextJSRouter] HTML: %@ -> %@", path, htmlPath)
            return htmlPath
        }

        // 4. Default fallback to root index.html
        NSLog("[NextJSRouter] FALLBACK: %@ -> %@", path, basePath + "/index.html")
        return basePath + "/index.html"
    }
}

class ViewController: CAPBridgeViewController {
    override open func router() -> Router {
        return NextJSRouter()
    }
}
