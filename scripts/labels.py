"""Checked display labels for the 2025 Rajasthan allotment PDFs.

The PDF text layer sometimes joins adjacent columns or two wrapped institution
rows. Keep these repairs explicit so a new, unreviewed specialty cannot silently
become a different course.
"""

from __future__ import annotations

import re


JNU = "Jaipur National University Institute for Medical Sciences and Research Centre, Jaipur."
TANTIA = "Dr. S.S Tantia Medical College, Hospital and Research Center, Sri Ganganagar"

MD_SPECIALTIES = {
    "Anaesthesia", "Anatomy", "Biochemistry", "Dermatology, Venereology and Leprosy",
    "Emergency Medicine", "Family Medicine", "Forensic Medicine", "General Medicine",
    "Geriatric Medicine", "Hospital Administration", "Immunohaematology and Blood Transfusion",
    "Laboratory Medicine", "Microbiology", "Nuclear Medicine", "Paediatrics",
    "Palliative Medicine", "Pathology", "Pharmacology", "Phy. Med. & Reh.",
    "Physiology", "PSM/Community Medicine", "Psychiatry", "Radiodiagnosis/Radiology",
    "Radiotherapy/Radiationoncology",
    "Respiratory Medicine/T.B. & Chest/Tuberculosis & Respiratory Diseases",
    "Tropical Medicine",
}
MS_SPECIALTIES = {
    "Anatomy", "ENT", "General Surgery", "Obst. & Gynaecology",
    "Ophthalmology", "Orthopaedics", "Traumatology & Surgery",
}
DIPLOMA_SPECIALTIES = {
    "Anesthesia", "ENT", "Family Medicine", "Obs & Gyne", "Ophthalmology",
    "Paediatrics", "Radio-diagnosis", "TB & Chest",
}
DNB_SPECIALTIES = {"Emergency Medicine", "Family Medicine"}
VALID_2025_COURSES = frozenset(
    {f"MD ({name})" for name in MD_SPECIALTIES}
    | {f"MS ({name})" for name in MS_SPECIALTIES}
    | {f"Post MBBS Diploma ({name})" for name in DIPLOMA_SPECIALTIES}
    | {f"Post MBBS DNB ({name})" for name in DNB_SPECIALTIES}
)
VALID_2025_COLLEGES = frozenset({
    "American International Institute Of Medical Sciences",
    "Ananta Institute of Medical Sciences and Research Centre, Rajsamand",
    "DH Banswara", "DH Baran", "DH Bundi", "DH Chittorgarh", "DH Dausa",
    "DH Hanumangarh", "DH Nagaur", "DH Pratapgarh", "DH Rajsamand",
    "DH Sirohi", "DH Sriganganagar", "DH Tonk", "District Hospital, Dholpur",
    "Dr SNMC Jodhpur", TANTIA, "ESIC Medical College And Hospital, Alwar",
    "GMC Bhilwara", "GMC Churu", "GMC Dungarpur", "GMC Pali",
    "GH Barmer", "GH Karauli", "GH Sawaimadhopur",
    "GOVERNMENT BDK HOSPITAL JHUNJHUNU", "GOVT. AMRITKAUR HOSPITAL BEAWAR",
    "Geetanjali Medical College & Hospital, Udaipur",
    "Government Hospital Alwar", "Govt District Hospital Kekri Ajmer",
    "Govt RDBP Jaipuria Hospital Jaipur", "Govt. DB General District Hospital, Churu",
    "Govt. Medical College, Kota", "JLN MC Ajmer", JNU,
    "Jhalawar Medical College Jhalawar", "MGH Bhilwara",
    "Mahatma Gandhi Medical College and Hospital, Jaipur",
    "National Institute of Medical Sciences & Research (NIMS), Jaipur",
    "Pacific Institute of Medical Sciences, Umarda, Udaipur",
    "Pacific Medical College & Hospital, Udaipur", "RBM Hospital Bharatpur",
    "RNT MC Udaipur", "RUHS College of Medical Sciences", "S K Hospital Sikar",
    "SMS Medical College Jaipur", "SPMC Bikaner",
    "Shri Hari Deo Joshi General Hospital Dungarpur",
    "Shri Jagannath Pahadiya Medical College Bharatpur or GMC Bharatpur",
})

# These were checked against the printed course column on their source pages.
# The letters before MD/MS are tails of candidate names in the neighbouring column.
COURSE_PREFIX_ERRORS = (
    "PATMD", "THEMD", "BHMD", "BMD", "TAMD", "SINMD", "SHMD",
    "SHAMD", "KHAMD", "CHMS", "PAMS", "PMS", "GAMS",
)
BARE_MD = {
    "Anaesthesia", "Forensic Medicine", "General Medicine", "Geriatric Medicine",
    "Paediatrics", "Palliative Medicine", "Pathology", "Pharmacology", "Physiology",
    "Radiodiagnosis/Radiology", "Radiotherapy/Radiationoncology",
    "Respiratory Medicine/T.B. & Chest/Tuberculosis & Respiratory Diseases",
}
BARE_MS = {"ENT", "General Surgery", "Obst. & Gynaecology", "Ophthalmology", "Orthopaedics"}


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_2025_college(raw: str) -> str:
    college = clean(raw)
    # The tail of a wrapped college name is sometimes assigned to the next
    # candidate, while its first line is appended to the preceding candidate.
    if college in {"Centre, Jaipur.", "Jaipur."}:
        college = JNU
    elif college == "Ganganagar":
        college = TANTIA
    else:
        duplicate_jnu = " " + JNU.removesuffix(" Centre, Jaipur.")
        if duplicate_jnu in college:
            college = college.split(duplicate_jnu, 1)[0]
        if " Dr. S.S Tantia Medical College" in college:
            college = college.split(" Dr. S.S Tantia Medical College", 1)[0]
        if college.startswith("Dr. S.S Tantia Medical College"):
            college = TANTIA
    assert college and not any(x in college for x in (
        " Jaipur National University Institute", " Dr. S.S Tantia Medical College",
    )), (raw, college)
    assert college in VALID_2025_COLLEGES, (raw, college)
    return college


def normalize_2025_course(raw: str) -> str:
    course = clean(raw)
    if "Skin & V.D" in course or "Dermatology Ven." in course:
        course = "MD Dermatology, Venereology and Leprosy"
    for prefix in COURSE_PREFIX_ERRORS:
        if course.startswith(prefix):
            course = prefix[-2:] + course[len(prefix):]
            break
    if course.startswith("MBBS Diplom"):
        course = "Post " + course
    course = re.sub(r"^Post MBBS Diplom(?:a)?\s*", "Post MBBS Diploma ", course)
    if course.endswith("Respiratory Medicine/T.B. & Chest/Tuberculosis & Respiratory"):
        course += " Diseases"
    if course.endswith("Respiratory Medicine/T.B. & Chest/Tub"):
        course = course.removesuffix("Respiratory Medicine/T.B. & Chest/Tub") + \
            "Respiratory Medicine/T.B. & Chest/Tuberculosis & Respiratory Diseases"
    if course.endswith("Immunohaematology and Blood Transf"):
        course = course.removesuffix("Immunohaematology and Blood Transf") + \
            "Immunohaematology and Blood Transfusion"
    if course in BARE_MD or course == "Anatomy":
        # The single bare Anatomy row (PM2844, Round 3, p.63) prints MD
        # against the preceding name; the other Anatomy rows retain MD or MS.
        course = "MD " + course
    elif course in BARE_MS:
        course = "MS " + course
    match = re.fullmatch(r"(MD|MS|Post MBBS Diploma|Post MBBS DNB)\s*\(?(.+?)\)?", course)
    assert match, (raw, course)
    course = f"{match.group(1)} ({match.group(2).rstrip(')')})"
    assert course in VALID_2025_COURSES, (raw, course)
    return course
