'use strict';
(() => {
  function redact(value, key = '') {
    let text = String(value ?? '');
    if (key) {
      text = text.split(key).join('[키 가림]');
      text = text.split(encodeURIComponent(key)).join('[키 가림]');
    }
    return text
      .replace(/([?&](?:appkey|key)=)(?!\[키 가림\])[^&\s"'<>]+/gi, '$1[키 가림]')
      .replace(/\b[a-f0-9]{32,}\b/gi, '[키 가림]');
  }

  function classify(value, key = '') {
    const safe = redact(value, key).trim().slice(0, 10000);
    if (!safe) return null;
    let message = safe;
    let errorType = '';
    try {
      const body = JSON.parse(safe);
      if (body && typeof body === 'object' && typeof body.message === 'string') {
        message = body.message;
        errorType = typeof body.errorType === 'string' ? body.errorType : '';
      }
    } catch { /* A pasted message can be plain text. */ }
    const evidence = errorType + ' ' + message;
    const base = { message, errorType, safe };
    if (/domain\s+mismatched/i.test(evidence)) {
      return { ...base, category: 'domain', title: '호출한 주소와 등록된 도메인이 다르다는 응답입니다.', action: '지금 입력한 JavaScript 키를 선택한 뒤, 그 키의 JavaScript SDK 도메인에 이 페이지의 주소가 등록되어 있는지 확인해 주세요. 다른 키나 제품 링크의 웹 도메인에만 등록한 경우도 확인해 주세요.' };
    }
    if (/disabled\s+OPEN_MAP_AND_LOCAL\s+service/i.test(evidence)) {
      return { ...base, category: 'disabled', title: '이 키의 앱에서 카카오맵이 비활성화되었다는 응답입니다.', action: '입력한 키가 속한 앱의 카카오맵 → 사용 설정이 ON인지 확인해 주세요. 이미 ON이면 같은 앱을 보고 있는지와 앱의 이용 권한·무료 쿼터 적용 여부를 확인해 주세요.' };
    }
    if (/wrong\s+appkey.*format/i.test(evidence)) {
      return { ...base, category: 'key-format', title: '입력한 키의 형식이 맞지 않는다는 응답입니다.', action: '카카오 Developers의 JavaScript 키 옆 복사 버튼으로 키 전체를 다시 복사해 넣어 주세요. 따옴표나 설명 문장이 함께 들어가지 않도록 확인해 주세요.' };
    }
    if (/quota|too\s+many\s+requests?|limit.*exceed|exceed.*limit/i.test(evidence)) {
      return { ...base, category: 'quota', title: '앱의 이용 한도를 확인해야 하는 응답입니다.', action: '해당 앱의 통계 → 쿼터와 앱 정보의 카카오맵 무료 쿼터 표시를 확인해 주세요. 유료 사용 설정은 비용과 조건을 확인한 뒤 결정해 주세요.' };
    }
    if (/invalid\s+appkey|appkey.*(?:not\s+found|invalid|not\s+exist)|not\s+exist.*appkey/i.test(evidence)) {
      return { ...base, category: 'key', title: '앱 키를 확인해야 하는 응답입니다.', action: '지도 Web SDK에 사용할 JavaScript 키인지, 현재 활성화된 키를 복사했는지 확인해 주세요.' };
    }
    return { ...base, category: 'unknown', title: '이 응답만으로 원인을 자동 분류하지 못했습니다.', action: '아래의 ‘키 없이 오류 복사’를 눌러 내용을 보내 주세요. 앱 키가 포함된 요청 주소 대신 오류 문구를 기준으로 확인할 수 있습니다.' };
  }

  function report({ origin, stage, code, response, key = '' }) {
    const result = classify(response, key);
    return redact([
      '카카오맵 연결 확인 · v2',
      '실행 주소: ' + origin,
      '실패 단계: ' + stage,
      '확인 코드: ' + code,
      result ? '카카오 오류: ' + (result.errorType ? result.errorType + ' / ' : '') + result.message : '카카오 오류 본문: 아직 붙여 넣지 않음',
      result ? '분류: ' + result.category : '',
    ].filter(Boolean).join('\n'), key);
  }

  window.MapLabDiagnostics = Object.freeze({ redact, classify, report });
})();
