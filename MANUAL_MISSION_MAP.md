# CPU WARS V4 — Manual-mapped mission bank

The **first attempt** uses missions 1–10 below in random sequence. Every additional attempt chooses **five of missions 1–10** and **five of missions 11–25**, then shuffles the combined ten.

The course material is `CPU_Power_Consumption.docx` (four pages). Mission watt limits, CPU temperatures and selectable options are **illustrative game settings**, not quoted measurements from the manual. In mission explanations we use the standard dynamic-power formula Pdynamic = α × C × V² × f; the uploaded manual's printed equation has its exponent misplaced even though its voltage-squared example and written explanation are correct.

| Bank ID | Mission | Related manual section |
|---:|---|---|
| 1 | Find the Power Thief | Manual p. 1: Components of CPU Power; Dynamic Power vs. Static Power |
| 2 | DVFS: Reading Mode | Manual pp. 1–3: Dynamic Power formula and DVFS; Smartphone example |
| 3 | Gate the Idle Blocks | Manual pp. 2–3: Clock Gating; Power Gating; Hardware Accelerators |
| 4 | Thermal Throttling Crisis | Manual pp. 2–3: Factors That Affect Power; Thermal Throttling; Smartphone example |
| 5 | Smart Farm: Wake, Read, Sleep | Manual p. 4: Battery-Powered Agricultural Monitoring example |
| 6 | Leakage vs. Fast Wake-Up | Manual pp. 1–3: Static Power; Clock/Power Gating; CPU Power Management example |
| 7 | DVFS: Gaming Mode | Manual pp. 2–3: DVFS; How Power Management Works; Smartphone example |
| 8 | Ready Now or Sleep Longer? | Manual pp. 2–3: Clock Gating; Power Gating; Low-Power Modes; Hardware Accelerators |
| 9 | Beat the Heat | Manual pp. 2–3: Factors That Affect CPU Power; Thermal Throttling |
| 10 | Farm Endurance Finale | Manual pp. 3–4: Power versus Energy; Embedded-System Agricultural Monitoring |
| 11 | Radio Standby Strategy | Manual pp. 1–2: Static Power; Clock Gating; Power Gating |
| 12 | DVFS: Balanced Workload | Manual pp. 1–2: Dynamic Power; DVFS; Factors Affecting CPU Power |
| 13 | Network Alert at Dawn | Manual pp. 2–3: Clock Gating; Power Gating; Memory and I/O Activity |
| 14 | Thermal Safety Check | Manual pp. 2–3: Number of Active Cores; Thermal Throttling |
| 15 | Wearable Wake Cycle | Manual pp. 2–3: Sleep and Low-Power Modes; Wearable Devices |
| 16 | Graphics Wakes First | Manual pp. 1–3: Dynamic vs. Static Power; Clock Gating; Power Gating |
| 17 | DVFS: Video Processing | Manual pp. 2–3: DVFS; Hardware Accelerators; How Power Management Works |
| 18 | Accelerator Wake-Up | Manual pp. 2–3: Hardware Accelerators; Clock Gating; Power Gating |
| 19 | Workload Spike | Manual pp. 2–3: Workload; CPU Cores; Thermal Throttling |
| 20 | Wireless Sensor Endurance | Manual pp. 3–4: Wireless Sensor Nodes; Battery-Powered Agriculture |
| 21 | Power-State Mix | Manual pp. 1–3: Dynamic Power; Static Power; Clock Gating; Power Gating |
| 22 | DVFS: Peak Demand | Manual pp. 2–3: DVFS; Smartphone Game Example; Processor Performance |
| 23 | Dual Wake-Up Alert | Manual pp. 2–3: Co-Processors and Hardware Accelerators; Power Gating |
| 24 | Protect the Processor | Manual pp. 2–3: Active Cores; Temperature; Thermal Throttling |
| 25 | Solar Farm Duty Cycle | Manual pp. 3–4: Battery and Solar Supply; Agricultural Monitoring |

Each mission uses the existing five simulation types (block-state optimization, DVFS, embedded I/O gating, thermal management, and periodic sleep). Different missions have different constraints and appropriately generated full-credit configurations. The first 10 missions are unchanged from V3.1.
