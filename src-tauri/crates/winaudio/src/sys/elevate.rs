//! Admin changes: the app relaunches its own exe elevated (`runas`, one UAC
//! prompt per batch) with `--apply-admin <hex>`, where `<hex>` is the
//! hex-encoded JSON list of changes. The elevated process runs only the
//! allow-listed admin changes (`Change::needs_admin`), stops at the first one
//! that fails or does not read back, and reports its index in the exit code.
//! This side then reads every change back itself, unelevated.
//!
//! Nothing touches the file system as administrator: there is no plan or
//! result file that a user-level process could swap or redirect. (An earlier
//! version used a temp folder, which allowed a plan swap during the UAC prompt
//! and an admin write through a junction.) Hex keeps the argument free of
//! quotes and spaces, so no command-line quoting is involved, and the renderer
//! never builds it.

use std::path::Path;

use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, ERROR_CANCELLED, WAIT_OBJECT_0};
use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject};
use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

use crate::model::{Change, ChangeResult};

/// The command-line switch of the elevated helper.
pub const ADMIN_ARG: &str = "--apply-admin";
/// The UAC prompt was declined: no admin change ran.
pub const DECLINED: &str = "The Windows permission prompt was declined.";
const WAIT_MS: u32 = 120_000;
/// Longest accepted argument (a full admin plan is a few hundred characters).
const MAX_ARG: usize = 16 * 1024;
/// Exit code: every change was applied and read back.
const EXIT_OK: u32 = 0;
/// Exit code: no plan argument.
const EXIT_NO_ARG: u32 = 2;
/// Exit code: the argument is not hex-encoded JSON changes.
const EXIT_BAD_ARG: u32 = 3;
/// Exit code: empty, or a change that is not on the admin allow-list.
const EXIT_NOT_ADMIN: u32 = 4;
/// Exit code base: change `i` failed, reported as `FAILED_AT + i`.
const FAILED_AT: u32 = 100;

fn encode(changes: &[Change]) -> Result<String, String> {
    let json = serde_json::to_vec(changes).map_err(|e| e.to_string())?;
    Ok(json.iter().map(|b| format!("{b:02x}")).collect())
}

fn decode(arg: &str) -> Option<Vec<Change>> {
    if arg.is_empty() || arg.len() > MAX_ARG || !arg.len().is_multiple_of(2) {
        return None;
    }
    let bytes = (0..arg.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(arg.get(i..i + 2)?, 16).ok())
        .collect::<Option<Vec<u8>>>()?;
    serde_json::from_slice(&bytes).ok()
}

/// Runs admin `changes` through the elevated helper. Non-admin changes are
/// refused here (they go through `apply`).
pub fn apply_admin(changes: &[Change]) -> Result<Vec<ChangeResult>, String> {
    if let Some(c) = changes.iter().find(|c| !c.needs_admin()) {
        return Err(format!("not an administrator change: {c:?}"));
    }
    if changes.is_empty() {
        return Ok(Vec::new());
    }
    let arg = encode(changes)?;
    let exe = std::env::current_exe().map_err(|e| format!("own exe: {e}"))?;
    match run_elevated(&exe, &arg) {
        Err(e) if e == DECLINED => Ok(changes
            .iter()
            .map(|c| ChangeResult::failed(c.clone(), DECLINED))
            .collect()),
        Err(e) => Err(e),
        Ok(code) => Ok(results_for(changes, code, super::apply::admin_reads_back)),
    }
}

/// Turns the helper's exit code into one result per change, reading back the
/// ones it reports as done (`reads_back` runs unelevated).
fn results_for(
    changes: &[Change],
    code: u32,
    reads_back: impl Fn(&Change) -> bool,
) -> Vec<ChangeResult> {
    let failed_at = match code {
        EXIT_OK => None,
        c if c >= FAILED_AT && ((c - FAILED_AT) as usize) < changes.len() => {
            Some((c - FAILED_AT) as usize)
        }
        c => {
            let error = format!("The administrator helper refused the changes (code {c}).");
            return changes
                .iter()
                .map(|ch| ChangeResult::failed(ch.clone(), error.clone()))
                .collect();
        }
    };
    let mut stopped = false;
    changes
        .iter()
        .enumerate()
        .map(|(i, change)| {
            if stopped {
                return ChangeResult::failed(
                    change.clone(),
                    "Skipped after an earlier change failed.",
                );
            }
            if failed_at == Some(i) {
                stopped = true;
                return ChangeResult::failed(
                    change.clone(),
                    "The change failed in the administrator helper.",
                );
            }
            let verified = reads_back(change);
            stopped = !verified;
            ChangeResult {
                change: change.clone(),
                applied: true,
                verified,
                error: (!verified).then(|| "The new value did not read back.".to_string()),
            }
        })
        .collect()
}

fn run_elevated(exe: &Path, arg: &str) -> Result<u32, String> {
    let file = HSTRING::from(exe.as_os_str());
    let params = HSTRING::from(format!("{ADMIN_ARG} {arg}"));
    let verb = HSTRING::from("runas");
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(params.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };
    unsafe {
        if let Err(e) = ShellExecuteExW(&mut info) {
            return Err(if e.code() == ERROR_CANCELLED.to_hresult() {
                DECLINED.to_string()
            } else {
                format!("could not start the helper: {e}")
            });
        }
        let waited = WaitForSingleObject(info.hProcess, WAIT_MS);
        let mut code = 0u32;
        let got = GetExitCodeProcess(info.hProcess, &mut code);
        let _ = CloseHandle(info.hProcess);
        if waited != WAIT_OBJECT_0 {
            return Err("the helper did not finish in time".into());
        }
        got.map_err(|e| format!("the helper's exit code: {e}"))?;
        Ok(code)
    }
}

/// The elevated helper's entry: `Some(exit code)` when `args` asks for it
/// (`<exe> --apply-admin <hex>`), `None` for a normal launch. It reads and
/// writes no files.
pub fn run_admin_cli(args: &[String]) -> Option<i32> {
    run_admin_cli_with(args, super::apply::apply_admin_here)
}

fn run_admin_cli_with(
    args: &[String],
    apply: impl FnOnce(&[Change]) -> Option<usize>,
) -> Option<i32> {
    if args.get(1).map(String::as_str) != Some(ADMIN_ARG) {
        return None;
    }
    let Some(arg) = args.get(2) else {
        return Some(EXIT_NO_ARG as i32);
    };
    let Some(changes) = decode(arg) else {
        return Some(EXIT_BAD_ARG as i32);
    };
    if changes.is_empty() || changes.iter().any(|c| !c.needs_admin()) {
        return Some(EXIT_NOT_ADMIN as i32);
    }
    Some(match apply(&changes) {
        None => EXIT_OK as i32,
        Some(i) => (FAILED_AT as usize + i) as i32,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(rest: &[&str]) -> Vec<String> {
        std::iter::once("app.exe")
            .chain(rest.iter().copied())
            .map(String::from)
            .collect()
    }

    fn never(_: &[Change]) -> Option<usize> {
        panic!("must not apply")
    }

    fn admin_changes() -> Vec<Change> {
        vec![
            Change::SetAbsoluteVolumeDisabled { disabled: false },
            Change::SetAdapterPowerSaving { allowed: false },
        ]
    }

    #[test]
    fn a_normal_launch_is_not_the_helper() {
        assert_eq!(run_admin_cli(&args(&[])), None);
        assert_eq!(run_admin_cli(&args(&["--minimized"])), None);
    }

    #[test]
    fn the_helper_refuses_missing_malformed_or_user_level_plans() {
        assert_eq!(run_admin_cli_with(&args(&[ADMIN_ARG]), never), Some(2));
        // A path (the old file-based form), odd length, non-hex, oversized.
        let oversized = "00".repeat(MAX_ARG);
        for bad in [
            r"C:\Windows\Temp\plan-1-1.json",
            "abc",
            "zz",
            oversized.as_str(),
        ] {
            assert_eq!(
                run_admin_cli_with(&args(&[ADMIN_ARG, bad]), never),
                Some(3),
                "{bad}"
            );
        }
        let user = encode(&[Change::SetMonoAudio { enabled: false }]).expect("encode");
        assert_eq!(
            run_admin_cli_with(&args(&[ADMIN_ARG, &user]), never),
            Some(4)
        );
        let empty = encode(&[]).expect("encode");
        assert_eq!(
            run_admin_cli_with(&args(&[ADMIN_ARG, &empty]), never),
            Some(4)
        );
    }

    #[test]
    fn the_helper_runs_the_decoded_admin_changes_and_reports_the_first_failure() {
        let changes = admin_changes();
        let arg = encode(&changes).expect("encode");
        assert!(
            arg.bytes().all(|b| b.is_ascii_hexdigit()),
            "no quoting needed"
        );
        let ran = std::cell::RefCell::new(Vec::new());
        let code = run_admin_cli_with(&args(&[ADMIN_ARG, &arg]), |c| {
            ran.borrow_mut().extend_from_slice(c);
            Some(1)
        });
        assert_eq!(code, Some(101));
        assert_eq!(*ran.borrow(), changes);
        assert_eq!(
            run_admin_cli_with(&args(&[ADMIN_ARG, &arg]), |_| None),
            Some(0)
        );
    }

    #[test]
    fn exit_codes_become_results_with_an_unelevated_read_back() {
        let changes = admin_changes();
        let ok = results_for(&changes, 0, |_| true);
        assert!(ok
            .iter()
            .all(|r| r.applied && r.verified && r.error.is_none()));

        let second_failed = results_for(&changes, 101, |_| true);
        assert!(second_failed[0].verified);
        assert!(!second_failed[1].applied && second_failed[1].error.is_some());

        let no_read_back = results_for(&changes, 0, |_| false);
        assert!(no_read_back[0].applied && !no_read_back[0].verified);
        assert_eq!(
            no_read_back[1].error.as_deref(),
            Some("Skipped after an earlier change failed.")
        );

        let refused = results_for(&changes, 3, |_| panic!("no read-back"));
        assert!(refused.iter().all(|r| !r.applied));
    }

    #[test]
    fn apply_admin_refuses_user_changes() {
        let err = apply_admin(&[Change::SetMonoAudio { enabled: false }]).expect_err("refused");
        assert!(err.starts_with("not an administrator change"), "{err}");
    }
}
