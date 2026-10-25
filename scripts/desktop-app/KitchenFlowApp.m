#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static NSString *const KitchenFlowAddress = @"http://localhost:5173/";

@interface KitchenFlowAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) NSTask *startupTask;
@property(nonatomic, strong) NSMutableData *startupOutput;
@end

@implementation KitchenFlowAppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [self configureMenu];

  WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
  configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
  self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
  self.webView.navigationDelegate = self;
  self.webView.UIDelegate = self;

  self.window = [[NSWindow alloc]
    initWithContentRect:NSMakeRect(0, 0, 1280, 820)
    styleMask:(NSWindowStyleMaskTitled |
               NSWindowStyleMaskClosable |
               NSWindowStyleMaskMiniaturizable |
               NSWindowStyleMaskResizable |
               NSWindowStyleMaskFullSizeContentView)
    backing:NSBackingStoreBuffered
    defer:NO];
  self.window.title = @"KitchenFlow";
  self.window.minSize = NSMakeSize(900, 620);
  self.window.contentView = self.webView;
  [self.window center];
  [self.window makeKeyAndOrderFront:nil];
  [NSApp activateIgnoringOtherApps:YES];

  [self showStatus:@"Запускаем KitchenFlow"
            detail:@"Проверяем базу данных и локальные сервисы…"];
  [self startKitchenFlow];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
  return YES;
}

- (nullable WKWebView *)webView:(WKWebView *)webView
 createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
            forNavigationAction:(WKNavigationAction *)navigationAction
                 windowFeatures:(WKWindowFeatures *)windowFeatures {
  if (navigationAction.targetFrame == nil && navigationAction.request.URL != nil) {
    [NSWorkspace.sharedWorkspace openURL:navigationAction.request.URL];
  }
  return nil;
}

- (void)configureMenu {
  NSMenu *mainMenu = [[NSMenu alloc] init];

  NSMenuItem *applicationItem = [[NSMenuItem alloc] init];
  NSMenu *applicationMenu = [[NSMenu alloc] init];
  [applicationMenu addItemWithTitle:@"Закрыть KitchenFlow"
                             action:@selector(terminate:)
                      keyEquivalent:@"q"];
  applicationItem.submenu = applicationMenu;
  [mainMenu addItem:applicationItem];

  NSMenuItem *editItem = [[NSMenuItem alloc] init];
  NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Правка"];
  [editMenu addItemWithTitle:@"Отменить"
                      action:@selector(undo:)
               keyEquivalent:@"z"];
  NSMenuItem *redoItem = [editMenu addItemWithTitle:@"Повторить"
                                             action:@selector(redo:)
                                      keyEquivalent:@"Z"];
  redoItem.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagShift;
  [editMenu addItem:NSMenuItem.separatorItem];
  [editMenu addItemWithTitle:@"Вырезать"
                      action:@selector(cut:)
               keyEquivalent:@"x"];
  [editMenu addItemWithTitle:@"Копировать"
                      action:@selector(copy:)
               keyEquivalent:@"c"];
  [editMenu addItemWithTitle:@"Вставить"
                      action:@selector(paste:)
               keyEquivalent:@"v"];
  NSMenuItem *controlPasteItem = [editMenu addItemWithTitle:@"Вставить (Ctrl+V)"
                                                     action:@selector(paste:)
                                              keyEquivalent:@"v"];
  controlPasteItem.keyEquivalentModifierMask = NSEventModifierFlagControl;
  [editMenu addItemWithTitle:@"Выбрать всё"
                      action:@selector(selectAll:)
               keyEquivalent:@"a"];
  editItem.submenu = editMenu;
  [mainMenu addItem:editItem];

  NSMenuItem *viewItem = [[NSMenuItem alloc] init];
  NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"Вид"];
  NSMenuItem *reloadItem = [viewMenu addItemWithTitle:@"Обновить"
                                               action:@selector(reloadPage:)
                                        keyEquivalent:@"r"];
  reloadItem.target = self;
  viewItem.submenu = viewMenu;
  [mainMenu addItem:viewItem];
  NSApp.mainMenu = mainMenu;
}

- (void)reloadPage:(id)sender {
  if (self.webView.URL == nil) {
    [self startKitchenFlow];
  } else {
    [self.webView reload];
  }
}

- (void)startKitchenFlow {
  if (self.startupTask != nil) return;

  NSURL *scriptURL = [NSBundle.mainBundle URLForResource:@"start-kitchenflow"
                                           withExtension:@"sh"];
  if (scriptURL == nil) {
    [self showFailure:@"В приложении отсутствует сценарий запуска."];
    return;
  }

  self.startupOutput = [NSMutableData data];
  NSPipe *outputPipe = [NSPipe pipe];
  NSTask *task = [[NSTask alloc] init];
  task.executableURL = [NSURL fileURLWithPath:@"/bin/zsh"];
  task.arguments = @[scriptURL.path];
  task.standardOutput = outputPipe;
  task.standardError = outputPipe;

  __weak typeof(self) weakSelf = self;
  outputPipe.fileHandleForReading.readabilityHandler = ^(NSFileHandle *handle) {
    NSData *data = handle.availableData;
    if (data.length == 0) return;
    @synchronized (weakSelf.startupOutput) {
      [weakSelf.startupOutput appendData:data];
    }
  };
  task.terminationHandler = ^(NSTask *completedTask) {
    dispatch_async(dispatch_get_main_queue(), ^{
      typeof(self) strongSelf = weakSelf;
      if (strongSelf == nil) return;
      outputPipe.fileHandleForReading.readabilityHandler = nil;
      strongSelf.startupTask = nil;
      if (completedTask.terminationStatus == 0) {
        NSURL *url = [NSURL URLWithString:KitchenFlowAddress];
        [strongSelf.webView loadRequest:[NSURLRequest requestWithURL:url]];
      } else {
        NSString *details = [[NSString alloc] initWithData:strongSelf.startupOutput
                                                  encoding:NSUTF8StringEncoding];
        [strongSelf showFailure:details ?: @"Неизвестная ошибка запуска"];
      }
    });
  };

  NSError *error = nil;
  if (![task launchAndReturnError:&error]) {
    [self showFailure:error.localizedDescription];
    return;
  }
  self.startupTask = task;
}

- (void)showFailure:(NSString *)details {
  NSString *shortDetails = details.length > 4000
    ? [details substringFromIndex:details.length - 4000]
    : details;
  [self showHTML:[NSString stringWithFormat:
    @"<div class='mark'>!</div>"
     "<h1>KitchenFlow не запустился</h1>"
     "<p>Убедитесь, что Docker Desktop открыт, затем нажмите ⌘R.</p>"
     "<pre>%@</pre>", [self escaped:shortDetails]]];
}

- (void)showStatus:(NSString *)title detail:(NSString *)detail {
  [self showHTML:[NSString stringWithFormat:
    @"<div class='mark'><svg viewBox='0 0 24 24' aria-hidden='true'>"
     "<path d='M11.9831 14.0001V3.00006M11.9831 14.0001C10.3247 14.0001 8.98038 15.4355 8.98038 16.6251C8.98038 18.3751 10.3247 21.0001 11.9831 21.0001C13.6414 21.0001 14.9857 18.3751 14.9857 16.6251C14.9857 15.4355 13.6414 14.0001 11.9831 14.0001Z'/>"
     "<path d='M4.97841 10.0283L4.97841 21M3.68615 3.12945L2.90347 3.20753C2.33225 3.26452 1.92596 3.78885 2.01382 4.35564L2.6828 8.67118C2.79612 9.40225 3.426 10.0106 4.16644 10.0106H5.7904C6.53083 10.0106 7.16071 9.40225 7.27404 8.67118L7.94301 4.35564C8.03087 3.78885 7.62458 3.26452 7.05336 3.20753L6.27337 3.12962C5.41311 3.04368 4.54642 3.04363 3.68615 3.12945Z'/>"
     "<path d='M17.996 13.8182L17.996 3.02594C19.1545 3.34592 21.0815 4.55268 21.4006 7.52842L21.9737 12.0424C22.0743 12.8351 21.8727 13.6261 21.0846 13.7616C20.4244 13.8751 19.4229 13.9122 17.996 13.8182ZM17.996 13.8182L17.996 21.0001'/>"
     "</svg></div><h1>%@</h1><p>%@</p><div class='loader'></div>",
    [self escaped:title], [self escaped:detail]]];
}

- (void)showHTML:(NSString *)content {
  NSString *html = [NSString stringWithFormat:
    @"<!doctype html><html lang='ru'><meta charset='utf-8'><style>"
     ":root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,sans-serif}"
     "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f4ef;color:#2a2521}"
     "main{width:min(560px,calc(100vw - 64px));text-align:center}"
     ".mark{width:64px;height:64px;margin:0 auto 24px;display:grid;place-items:center;border-radius:18px;background:#c96442;color:white}"
     ".mark svg{width:42px;height:42px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}"
     "h1{margin:0 0 10px;font-size:30px}p{margin:0;color:#746b64;font-size:16px;line-height:1.5}"
     ".loader{width:28px;height:28px;margin:28px auto 0;border:3px solid #dfd5cc;border-top-color:#c96442;border-radius:50%%;animation:spin .8s linear infinite}"
     "pre{overflow:auto;max-height:260px;margin-top:24px;padding:16px;border-radius:12px;background:#eee7df;text-align:left;white-space:pre-wrap;font-size:12px}"
     "@keyframes spin{to{transform:rotate(360deg)}}"
     "@media(prefers-color-scheme:dark){body{background:#201c19;color:#f5eee8}p{color:#b8aea6}pre{background:#302925}}"
     "</style><body><main>%@</main></body></html>", content];
  [self.webView loadHTMLString:html baseURL:nil];
}

- (NSString *)escaped:(NSString *)value {
  NSString *result = [value stringByReplacingOccurrencesOfString:@"&" withString:@"&amp;"];
  result = [result stringByReplacingOccurrencesOfString:@"<" withString:@"&lt;"];
  result = [result stringByReplacingOccurrencesOfString:@">" withString:@"&gt;"];
  return [result stringByReplacingOccurrencesOfString:@"\"" withString:@"&quot;"];
}

@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSApplication *application = NSApplication.sharedApplication;
    KitchenFlowAppDelegate *delegate = [[KitchenFlowAppDelegate alloc] init];
    [application setActivationPolicy:NSApplicationActivationPolicyRegular];
    application.delegate = delegate;
    [application run];
  }
  return 0;
}
