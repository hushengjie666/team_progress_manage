use tauri::Manager;

fn restore_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        #[cfg(target_os = "macos")]
        activate_macos_window(&window);
        let _ = window.set_focus();
    }
}

fn restore_main_window_on_main_thread<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let app_handle = app.clone();
    let _ = app.run_on_main_thread(move || restore_main_window(&app_handle));
}

#[tauri::command]
fn restore_main_window_command(app: tauri::AppHandle) {
    restore_main_window_on_main_thread(&app);
}

fn hide_main_window_on_close<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    event: &tauri::WindowEvent,
) {
    let tauri::WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    if label != "main" {
        return;
    }

    api.prevent_close();
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(target_os = "macos")]
fn activate_macos_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let Some(main_thread) = objc2::MainThreadMarker::new() else {
        return;
    };
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    if ns_window.is_null() {
        return;
    }

    unsafe {
        let ns_window = &*(ns_window.cast::<objc2_app_kit::NSWindow>());
        let ns_app = objc2_app_kit::NSApplication::sharedApplication(main_thread);
        let _ = ns_app.setActivationPolicy(objc2_app_kit::NSApplicationActivationPolicy::Regular);
        ns_window.makeKeyAndOrderFront(None);
        ns_window.orderFrontRegardless();

        #[allow(deprecated)]
        ns_app.activateIgnoringOtherApps(true);

        let running_app = objc2_app_kit::NSRunningApplication::currentApplication();
        let _ = running_app.unhide();
        #[allow(deprecated)]
        let activation_options = objc2_app_kit::NSApplicationActivationOptions::ActivateAllWindows
            | objc2_app_kit::NSApplicationActivationOptions::ActivateIgnoringOtherApps;
        let _ = running_app.activateWithOptions(activation_options);
    }
}

#[cfg(target_os = "macos")]
fn configure_macos_minimize_button<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(ns_window) = window.ns_window() else {
        return;
    };

    unsafe {
        let ns_window = ns_window.cast::<objc2::runtime::AnyObject>();
        let miniaturize_button: *mut objc2::runtime::AnyObject =
            objc2::msg_send![ns_window, standardWindowButton: 1usize];
        if miniaturize_button.is_null() {
            return;
        }

        let _: () = objc2::msg_send![miniaturize_button, setTarget: ns_window];
        let _: () = objc2::msg_send![miniaturize_button, setAction: objc2::sel!(orderOut:)];
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    if std::env::var_os("WDIO_EMBEDDED_SERVER").is_some() {
        builder = builder
            .plugin(tauri_plugin_wdio::init())
            .plugin(tauri_plugin_wdio_webdriver::init());
    }

    let app = builder
        .invoke_handler(tauri::generate_handler![restore_main_window_command])
        .setup(|app| {
            if cfg!(debug_assertions) && std::env::var_os("WDIO_EMBEDDED_SERVER").is_none() {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            let _ = app
                .handle()
                .set_activation_policy(tauri::ActivationPolicy::Regular);
            #[cfg(target_os = "macos")]
            configure_macos_minimize_button(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Ready = &event {
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
            restore_main_window_on_main_thread(app);
        }

        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = &event {
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
            restore_main_window_on_main_thread(app);
        }

        if let tauri::RunEvent::WindowEvent { label, event, .. } = &event {
            hide_main_window_on_close(app, label, event);
        }
    });
}
