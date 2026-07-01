from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from django.utils.text import slugify


@dataclass(frozen=True)
class MemberDisplayGroup:
    key: str
    label: str
    section: str


LEGACY_SECTION_GROUPS = {
    "MASTER MASONS - ACTIVE": MemberDisplayGroup(
        key="active",
        label="Active",
        section="MASTER MASONS - ACTIVE",
    ),
    "MASTER MASONS (DUAL/PLURAL) - ACTIVE": MemberDisplayGroup(
        key="dual_plural",
        label="Dual / Plural",
        section="MASTER MASONS (DUAL/PLURAL) - ACTIVE",
    ),
    "MASTER MASONS (HONORARY)": MemberDisplayGroup(
        key="honorary",
        label="Honorary",
        section="MASTER MASONS (HONORARY)",
    ),
    "MASTER MASONS - INACTIVE, SNPD, DEMIT": MemberDisplayGroup(
        key="inactive_snpd_demit",
        label="Inactive / SNPD / Demit",
        section="MASTER MASONS - INACTIVE, SNPD, DEMIT",
    ),
    "DROPED THE WORKING TOOLS": MemberDisplayGroup(
        key="dropped_working_tools",
        label="Dropped Working Tools",
        section="DROPED THE WORKING TOOLS",
    ),
}


def normalized_section(section: str) -> str:
    return re.sub(r"\s+", " ", section.strip()).upper()


def dynamic_group_label(section: str) -> str:
    cleaned = re.sub(r"\s+", " ", section.strip())
    if not cleaned:
        return "Unclassified"
    return cleaned.title().replace("Glp", "GLP").replace("Snpd", "SNPD")


def dynamic_group_key(section: str) -> str:
    normalized = normalized_section(section)
    if not normalized:
        return "unclassified"
    slug = slugify(normalized).replace("-", "_")
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:8]
    return f"{slug}_{digest}" if slug else f"section_{digest}"


def member_display_group_from_section(section: str) -> MemberDisplayGroup:
    normalized = normalized_section(section)
    legacy_group = LEGACY_SECTION_GROUPS.get(normalized)
    if legacy_group is not None:
        return legacy_group
    return MemberDisplayGroup(
        key=dynamic_group_key(section),
        label=dynamic_group_label(section),
        section=section.strip(),
    )
