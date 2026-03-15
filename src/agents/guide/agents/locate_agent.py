#!/usr/bin/env python
"""
LocateAgent - Agent for locating and organizing knowledge points
Analyzes notebook content and generates progressive knowledge point learning plans
"""

import json
import re
from typing import Any, Optional

from src.agents.base_agent import BaseAgent


class LocateAgent(BaseAgent):
    """Knowledge point location agent"""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        language: str = "zh",
        api_version: Optional[str] = None,
        binding: str = "openai",
    ):
        super().__init__(
            module_name="guide",
            agent_name="locate_agent",
            api_key=api_key,
            base_url=base_url,
            api_version=api_version,
            language=language,
            binding=binding,
        )

    def _extract_json_from_response(self, response: str) -> Any:
        """
        Extract JSON from response - handles arrays [], objects {}, code fences, and plain text.
        The prompt asks for a JSON array, so we prioritize array extraction.
        """
        # 1. Direct parse (handles clean array or object responses)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # 2. JSON array in code fences: ```json [...] ```
        for match in re.findall(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', response, re.IGNORECASE):
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue

        # 3. JSON object in code fences: ```json {...} ```
        for match in re.findall(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', response, re.IGNORECASE):
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue

        # 4. Bare JSON array anywhere in response
        for match in re.findall(r'\[[\s\S]*\]', response):
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue

        # 5. Bare JSON object anywhere in response
        for match in re.findall(r'\{[\s\S]*\}', response):
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue

        # 6. Fallback: parse plain text into structured format
        return self._parse_structured_text(response)

    def _parse_structured_text(self, response: str) -> dict[str, Any]:
        """Fallback: parse plain text response into knowledge points format."""
        knowledge_points = []
        current_point: dict[str, str] = {}

        for line in response.split('\n'):
            line = line.strip()
            if not line:
                if current_point.get('knowledge_title'):
                    knowledge_points.append(current_point)
                    current_point = {}
                continue

            # Numbered items like "1. Title" or "**1. Title**"
            num_match = re.match(r'^\*{0,2}(\d+)\.\s+(.+?)\*{0,2}$', line)
            if num_match:
                if current_point.get('knowledge_title'):
                    knowledge_points.append(current_point)
                current_point = {
                    'knowledge_title': num_match.group(2).strip(),
                    'knowledge_summary': '',
                    'user_difficulty': 'medium'
                }
                continue

            # Key: value lines
            kv_match = re.match(r'^[*-]?\s*([\w\s]+):\s*(.+)$', line)
            if kv_match and current_point:
                key = kv_match.group(1).lower().strip()
                val = kv_match.group(2).strip()
                if 'summary' in key or 'description' in key:
                    current_point['knowledge_summary'] = val
                elif 'difficulty' in key or 'level' in key:
                    current_point['user_difficulty'] = val
                elif 'title' in key:
                    current_point['knowledge_title'] = val
            elif current_point.get('knowledge_title') and not current_point.get('knowledge_summary'):
                current_point['knowledge_summary'] = line

        if current_point.get('knowledge_title'):
            knowledge_points.append(current_point)

        # Last resort: treat entire response as one knowledge point
        if not knowledge_points and response.strip():
            knowledge_points.append({
                'knowledge_title': 'Learning Content',
                'knowledge_summary': response.strip()[:300],
                'user_difficulty': 'medium'
            })

        return {'knowledge_points': knowledge_points}

    def _format_records(self, records: list[dict[str, Any]]) -> str:
        """Format notebook records as readable text"""
        formatted = []
        for i, record in enumerate(records, 1):
            record_type = record.get("type", "unknown")
            title = record.get("title", "Untitled")
            user_query = record.get("user_query", "")
            output = record.get("output", "")

            if len(output) > 2000:
                output = output[:2000] + "\n...[Content truncated]..."

            formatted.append(
                f"""
### Record {i} [{record_type.upper()}]
**Title**: {title}

**User Question/Input**:
{user_query}

**System Output**:
{output}
---"""
            )

        return "\n".join(formatted)

    async def process(
        self, notebook_id: str, notebook_name: str, records: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Analyze notebook content and generate knowledge point learning plan
        """
        if not records:
            return {"success": False, "error": "No records in notebook", "knowledge_points": []}

        system_prompt = self.get_prompt("system")
        if not system_prompt:
            raise ValueError("LocateAgent missing system prompt")

        user_template = self.get_prompt("user_template")
        if not user_template:
            raise ValueError("LocateAgent missing user_template")

        records_content = self._format_records(records)
        user_prompt = user_template.format(
            notebook_id=notebook_id,
            notebook_name=notebook_name,
            record_count=len(records),
            records_content=records_content,
        )

        try:
            response = await self.call_llm(
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response_format={"type": "json_object"},
            )

            try:
                result = self._extract_json_from_response(response)

                # Result can be a list (array) or dict with knowledge_points key
                if isinstance(result, list):
                    knowledge_points = result
                elif isinstance(result, dict):
                    knowledge_points = (
                        result.get("knowledge_points")
                        or result.get("points")
                        or result.get("data")
                        or []
                    )
                else:
                    knowledge_points = []

                validated_points = []
                for point in knowledge_points:
                    if isinstance(point, dict):
                        validated_points.append({
                            "knowledge_title": point.get("knowledge_title", "Unnamed knowledge point"),
                            "knowledge_summary": point.get("knowledge_summary", ""),
                            "user_difficulty": point.get("user_difficulty", ""),
                        })

                return {
                    "success": True,
                    "knowledge_points": validated_points,
                    "total_points": len(validated_points),
                }

            except Exception as e:
                self.logger.warning(f"Failed to parse response: {e}")
                return {
                    "success": False,
                    "error": f"Response parsing failed: {e!s}",
                    "raw_response": response,
                    "knowledge_points": [],
                }

        except Exception as e:
            return {"success": False, "error": str(e), "knowledge_points": []}
