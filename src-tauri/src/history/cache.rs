use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::seal::{context, CACHE_VALUE};
use super::{describe, with_account, History};
use crate::local_key;

const MAX_CACHE_SECTION_LENGTH: usize = 64;

fn valid_cache_section(section: &str) -> Result<(), String> {
    if section.is_empty() || section.len() > MAX_CACHE_SECTION_LENGTH {
        return Err("invalid cache section".to_string());
    }
    Ok(())
}

fn read_section(history: &History, section: &str) -> Result<Option<String>, String> {
    valid_cache_section(section)?;
    with_account(history, |account| {
        let sealed = account
            .connection
            .query_row(
                "SELECT value FROM cache WHERE section = ?1",
                params![section],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()
            .map_err(describe)?;
        Ok(sealed.and_then(|sealed| {
            local_key::unseal(&account.cipher, &sealed, &context(CACHE_VALUE, section))
        }))
    })
}

fn write_section(history: &History, section: &str, value: &str) -> Result<(), String> {
    valid_cache_section(section)?;
    with_account(history, |account| {
        let sealed = local_key::seal(&account.cipher, value, &context(CACHE_VALUE, section))?;
        account
            .connection
            .execute(
                "INSERT INTO cache (section, value) VALUES (?1, ?2)
                 ON CONFLICT (section) DO UPDATE SET value = excluded.value",
                params![section, sealed],
            )
            .map_err(describe)?;
        Ok(())
    })
}

#[tauri::command]
pub fn cache_get(history: State<History>, section: String) -> Result<Option<String>, String> {
    read_section(&history, &section)
}

#[tauri::command]
pub fn cache_put(history: State<History>, section: String, value: String) -> Result<(), String> {
    write_section(&history, &section, &value)
}

#[cfg(test)]
mod tests {
    use super::super::testing::{open, random_cipher, TestDir};
    use super::super::{with_account, History};
    use super::{read_section, write_section};
    use rusqlite::params;
    use std::time::{Duration, Instant};

    fn sealed_blob(history: &History, section: &str) -> Vec<u8> {
        with_account(history, |account| {
            account
                .connection
                .query_row(
                    "SELECT value FROM cache WHERE section = ?1",
                    params![section],
                    |row| row.get::<_, Vec<u8>>(0),
                )
                .map_err(|error| error.to_string())
        })
        .expect("sealed blob")
    }

    fn put_raw(history: &History, section: &str, blob: &[u8]) {
        with_account(history, |account| {
            account
                .connection
                .execute(
                    "INSERT INTO cache (section, value) VALUES (?1, ?2)
                     ON CONFLICT (section) DO UPDATE SET value = excluded.value",
                    params![section, blob],
                )
                .map_err(|error| error.to_string())
        })
        .expect("raw insert");
    }

    #[test]
    fn writes_and_reads_a_section() {
        let dir = TestDir::new("round-trip");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "friendsOnline", r#"["a","b"]"#).unwrap();
        assert_eq!(
            read_section(&history, "friendsOnline").unwrap().as_deref(),
            Some(r#"["a","b"]"#)
        );
    }

    #[test]
    fn overwrites_a_section() {
        let dir = TestDir::new("overwrite");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "presenceLiveAt", "1").unwrap();
        write_section(&history, "presenceLiveAt", "2").unwrap();
        assert_eq!(
            read_section(&history, "presenceLiveAt").unwrap().as_deref(),
            Some("2")
        );
    }

    #[test]
    fn missing_section_is_none() {
        let dir = TestDir::new("missing");
        let history = open(&dir.0, random_cipher(), true);
        assert_eq!(read_section(&history, "account").unwrap(), None);
    }

    #[test]
    fn rejects_invalid_section_names() {
        let dir = TestDir::new("invalid-name");
        let history = open(&dir.0, random_cipher(), true);
        let too_long = "x".repeat(65);
        assert!(write_section(&history, "", "1").is_err());
        assert!(write_section(&history, &too_long, "1").is_err());
        assert!(read_section(&history, "").is_err());
        assert!(read_section(&history, &too_long).is_err());
        assert!(write_section(&history, &"x".repeat(64), "1").is_ok());
    }

    #[test]
    fn stores_ciphertext_not_plain_text() {
        let dir = TestDir::new("ciphertext");
        let history = open(&dir.0, random_cipher(), true);
        let secret = "presence-of-friend-0123456789";
        write_section(&history, "friendsOnline", secret).unwrap();
        let blob = sealed_blob(&history, "friendsOnline");
        assert!(!blob
            .windows(secret.len())
            .any(|window| window == secret.as_bytes()));
        drop(history);
        let file = std::fs::read(dir.0.join("history.sqlite")).unwrap();
        let wal = std::fs::read(dir.0.join("history.sqlite-wal")).unwrap_or_default();
        for bytes in [file, wal] {
            assert!(!bytes
                .windows(secret.len())
                .any(|window| window == secret.as_bytes()));
        }
    }

    #[test]
    fn ciphertext_moved_to_another_section_does_not_decrypt() {
        let dir = TestDir::new("aad");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "friendsOnline", r#"["a"]"#).unwrap();
        let blob = sealed_blob(&history, "friendsOnline");
        put_raw(&history, "presence", &blob);
        assert_eq!(read_section(&history, "presence").unwrap(), None);
    }

    #[test]
    fn damaged_ciphertext_does_not_decrypt() {
        let dir = TestDir::new("damaged");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "account", "{}").unwrap();
        let mut blob = sealed_blob(&history, "account");
        let last = blob.len() - 1;
        blob[last] ^= 0x01;
        put_raw(&history, "account", &blob);
        assert_eq!(read_section(&history, "account").unwrap(), None);
        put_raw(&history, "account", &[1, 2, 3]);
        assert_eq!(read_section(&history, "account").unwrap(), None);
    }

    #[test]
    fn keeps_sections_across_reopen_with_the_same_key() {
        let dir = TestDir::new("reopen");
        let cipher = random_cipher();
        let history = open(&dir.0, cipher.clone(), true);
        write_section(&history, "presenceLiveAt", "1791039117456").unwrap();
        drop(history);
        let reopened = open(&dir.0, cipher, false);
        assert_eq!(
            read_section(&reopened, "presenceLiveAt")
                .unwrap()
                .as_deref(),
            Some("1791039117456")
        );
    }

    #[test]
    fn another_key_cannot_read_sections() {
        let dir = TestDir::new("other-key");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "presence", "{}").unwrap();
        drop(history);
        let reopened = open(&dir.0, random_cipher(), false);
        assert_eq!(read_section(&reopened, "presence").unwrap(), None);
    }

    #[test]
    fn a_fresh_key_clears_the_cache() {
        let dir = TestDir::new("fresh-key");
        let history = open(&dir.0, random_cipher(), true);
        write_section(&history, "presence", "{}").unwrap();
        drop(history);
        let reopened = open(&dir.0, random_cipher(), true);
        let rows: i64 = with_account(&reopened, |account| {
            account
                .connection
                .query_row("SELECT count(*) FROM cache", [], |row| row.get(0))
                .map_err(|error| error.to_string())
        })
        .unwrap();
        assert_eq!(rows, 0);
    }

    fn uuid(seed: usize) -> String {
        format!("00000000-0000-4000-8000-{seed:012}")
    }

    fn member_previews_json(servers: usize, rows: usize) -> String {
        let previews: Vec<String> = (1..=servers)
            .map(|server| {
                let members: Vec<String> = (0..rows)
                    .map(|index| {
                        let seed = server * 1000 + index;
                        format!(
                            r#"{{"id":"{}","username":"member_{seed}","name":"Member {seed}","avatarId":"{}","status":{}}}"#,
                            uuid(seed),
                            uuid(seed + 1_000_000),
                            if seed % 3 == 0 { r#""online""# } else { "null" }
                        )
                    })
                    .collect();
                format!(
                    r#""{}":{{"counts":{{"online":33,"offline":67}},"rows":[{}]}}"#,
                    uuid(server),
                    members.join(",")
                )
            })
            .collect();
        format!("{{{}}}", previews.join(","))
    }

    fn previews_live_at_json(servers: usize, at: u64) -> String {
        let entries: Vec<String> = (1..=servers)
            .map(|server| format!(r#""{}":{at}"#, uuid(server)))
            .collect();
        format!("{{{}}}", entries.join(","))
    }

    fn database_size(dir: &TestDir) -> u64 {
        dir.file_size("history.sqlite") + dir.file_size("history.sqlite-wal")
    }

    fn hour_of_stamps(history: &History, servers: usize, start: u64) -> Duration {
        let started = Instant::now();
        for stamp in 0..120u64 {
            let at = start + stamp * 30_000;
            write_section(history, "presenceLiveAt", &at.to_string()).unwrap();
            write_section(
                history,
                "previewsLiveAt",
                &previews_live_at_json(servers, at),
            )
            .unwrap();
        }
        started.elapsed()
    }

    #[test]
    #[ignore = "load measurement, run with: cargo test --release -- --ignored --nocapture"]
    fn an_hour_of_presence_stamps_is_cheap_on_real_sqlite() {
        let servers = 30;
        let dir = TestDir::new("load");
        let history = open(&dir.0, random_cipher(), true);
        let previews = member_previews_json(servers, 100);
        write_section(&history, "memberPreviews", &previews).unwrap();
        write_section(
            &history,
            "friendsOnline",
            &format!(
                "[{}]",
                (0..200)
                    .map(|i| format!(r#""{}""#, uuid(i)))
                    .collect::<Vec<_>>()
                    .join(",")
            ),
        )
        .unwrap();
        let baseline = database_size(&dir);

        let hours = 8;
        let mut hour_durations = Vec::new();
        let mut sizes = Vec::new();
        for hour in 0..hours {
            hour_durations.push(hour_of_stamps(
                &history,
                servers,
                1_791_039_117_456 + hour * 3_600_000,
            ));
            sizes.push(database_size(&dir));
        }
        let slowest_hour = hour_durations.iter().max().copied().unwrap_or_default();
        let peak_before_last_hours = sizes[..hours as usize - 2]
            .iter()
            .max()
            .copied()
            .unwrap_or(0);

        let started = Instant::now();
        for _ in 0..120 {
            write_section(&history, "memberPreviews", &previews).unwrap();
        }
        let old_scheme_hour = started.elapsed();
        let after_old_scheme = database_size(&dir);

        println!(
            "[sqlite load] previews {:.1} KB; stamps per hour: slowest {:.1} ms ({:.3} ms per stamp), all hours {:?} ms; \
             old scheme (rewrite previews every stamp): {:.1} ms per hour ({:.2} ms per stamp); \
             db+wal: baseline {:.0} KB, by hour {:?} KB, after old scheme {:.0} KB",
            previews.len() as f64 / 1024.0,
            slowest_hour.as_secs_f64() * 1000.0,
            slowest_hour.as_secs_f64() * 1000.0 / 120.0,
            hour_durations
                .iter()
                .map(|duration| (duration.as_secs_f64() * 10_000.0).round() / 10.0)
                .collect::<Vec<_>>(),
            old_scheme_hour.as_secs_f64() * 1000.0,
            old_scheme_hour.as_secs_f64() * 1000.0 / 120.0,
            baseline as f64 / 1024.0,
            sizes.iter().map(|size| size / 1024).collect::<Vec<_>>(),
            after_old_scheme as f64 / 1024.0
        );

        assert!(slowest_hour < Duration::from_secs(1));
        assert!(sizes.iter().all(|size| *size <= baseline + 6 * 1024 * 1024));
        assert!(sizes[hours as usize - 2..]
            .iter()
            .all(|size| *size <= peak_before_last_hours + 64 * 1024));
        assert_eq!(
            read_section(&history, "memberPreviews").unwrap().as_deref(),
            Some(previews.as_str())
        );
    }
}
