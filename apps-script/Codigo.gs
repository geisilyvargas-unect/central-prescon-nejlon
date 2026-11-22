/**
 * Central PRESCON · NEJLON — sincronização privada Apps Script
 *
 * Crie um projeto Apps Script INDEPENDENTE e PRIVADO na conta da PRESCON.
 * NÃO vincule este código diretamente à planilha compartilhada do Conselho.
 *
 * Antes de iniciar, preencha em "Configurações do projeto > Propriedades do script":
 *   PRESCON_SYNC_TOKEN    = chave criada pelo portal (não publicar no GitHub)
 *   PRESCON_SHEET_ID      = 1DdwqLHLDsHzD5dF344gKRtQSQMbhN-DplkqMc7z9sdI
 *
 * Não há doGet/doPost nem deploy público.
 * O token acessa somente indicadores agregados; jamais votos ou justificativas.
 */
const PRESCON_ENDPOINT = 'https://imsisbixzkqphooxyfhr.supabase.co/functions/v1/prescon-workspace?action=apps_script_snapshot';
const ALLOWED_SHEET_ID = '1DdwqLHLDsHzD5dF344gKRtQSQMbhN-DplkqMc7z9sdI';
const MANAGED_TAB = 'PRESCON_AUTOMACOES';
const HEADERS = ['EJ', 'Abertas', 'Pendentes', 'Em andamento', 'Justificadas', 'Concluídas', 'Vencidas', 'Atualizado em'];

/**
 * Executar manualmente uma vez: instala gatilho a cada 6h e sincroniza.
 * Executado exclusivamente pela conta Google que autorizou o Apps Script.
 */
function instalarCentralPrescon() {
  const props = PropertiesService.getScriptProperties();
  validarConfiguracao_(props);
  const handlers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sincronizarResumoPrescon');
  if (handlers.length === 0) ScriptApp.newTrigger('sincronizarResumoPrescon').timeBased().everyHours(6).create();
  sincronizarResumoPrescon();
}

/** Sincroniza somente a aba controlada pelo script; nenhuma aba existente é alterada. */
function sincronizarResumoPrescon() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw Error('Outra sincronização está em execução; tente novamente.');
  try {
    const props = PropertiesService.getScriptProperties();
    const config = validarConfiguracao_(props);
    const snapshot = buscarResumo_(config.token, config.sheetId);
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    let sheet = spreadsheet.getSheetByName(MANAGED_TAB);
    const registered = props.getProperty('PRESCON_MANAGED_TAB_GID');

    if (sheet && (!registered || String(sheet.getSheetId()) !== String(registered))) {
      throw Error('Já existe uma aba com esse nome, mas não foi criada por este script. Renomeie-a antes de iniciar.');
    }
    if (!sheet && registered) {
      throw Error('A aba gerenciada anteriormente não existe mais. Verifique antes de recriar.');
    }
    if (!sheet) {
      sheet = spreadsheet.insertSheet(MANAGED_TAB);
      props.setProperty('PRESCON_MANAGED_TAB_GID', String(sheet.getSheetId()));
    }

    const when = Utilities.formatDate(new Date(snapshot.generated_at), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const rows = [
      ['NEJLON · PANORAMA AUTOMÁTICO PRESCON', '', '', '', '', '', '', ''],
      ['Última atualização: ' + when, '', '', '', '', '', '', ''],
      ['Somente totais por EJ; sem votos, comprovantes ou justificativas individuais.', '', '', '', '', '', '', ''],
      ['EJs: ' + snapshot.totals.ejs, 'Demandas: ' + snapshot.totals.demands,
        'Em aberto: ' + snapshot.totals.open_demands, 'Vencidas: ' + snapshot.totals.expired_demands,
        'Formulários abertos: ' + snapshot.totals.open_forms, '', '', ''],
      ['', '', '', '', '', '', '', ''],
      HEADERS
    ];
    snapshot.ejs.forEach(e => rows.push([
      textoSeguro_(e.ej), numeroSeguro_(e.abertas), numeroSeguro_(e.pendentes),
      numeroSeguro_(e.andamento), numeroSeguro_(e.justificadas),
      numeroSeguro_(e.concluidas), numeroSeguro_(e.vencidas), when
    ]));

    const count = Math.max(sheet.getLastRow(), rows.length);
    if (count > 500) throw Error('A aba gerenciada possui linhas demais. Revise antes de limpar.');
    if (sheet.getMaxRows() < rows.length) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows());
    if (sheet.getMaxColumns() < 8) sheet.insertColumnsAfter(sheet.getMaxColumns(), 8 - sheet.getMaxColumns());

    if (count > 0) sheet.getRange(1, 1, count, 8).clearContent();
    sheet.getRange(1, 1, rows.length, 8).setValues(rows);
    sheet.getRange(1, 1, 1, 8).setBackground('#212023').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.getRange(6, 1, 1, 8).setBackground('#C92F37').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.getRange(7, 2, Math.max(rows.length - 6, 1), 6).setNumberFormat('0');
    sheet.setFrozenRows(6);
    sheet.autoResizeColumns(1, 8);
    SpreadsheetApp.flush();
    props.setProperty('PRESCON_LAST_SYNC_AT', new Date().toISOString());
    return 'Atualizado com sucesso: ' + snapshot.ejs.length + ' EJs, somente na aba ' + MANAGED_TAB + '.';
  } catch (e) {
    // Nunca inclua a chave em mensagens de erro ou logs.
    console.error('Falha na sincronização PRESCON: ' + String(e.message || e).slice(0, 250));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Consulta o estado do serviço sem expor a chave. */
function verificarCentralPrescon() {
  const p = PropertiesService.getScriptProperties();
  return {
    configurada: !!(p.getProperty('PRESCON_SYNC_TOKEN') && p.getProperty('PRESCON_SHEET_ID')),
    ultimaSincronizacao: p.getProperty('PRESCON_LAST_SYNC_AT') || 'Ainda não executada',
    aba: MANAGED_TAB
  };
}

/** Desativa somente os gatilhos deste código. Nenhuma outra automação será apagada. */
function desativarCentralPrescon() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sincronizarResumoPrescon')
    .forEach(t => ScriptApp.deleteTrigger(t));
  return 'Automação desativada. A planilha permanece inalterada.';
}

function validarConfiguracao_(props) {
  const token = props.getProperty('PRESCON_SYNC_TOKEN') || '';
  const sheetId = props.getProperty('PRESCON_SHEET_ID') || '';
  if (!/^psc_[a-zA-Z0-9_-]{43}$/.test(token)) throw Error('Crie uma chave no portal e configure PRESCON_SYNC_TOKEN nas Propriedades do script.');
  if (sheetId !== ALLOWED_SHEET_ID) throw Error('A integração inicial só autoriza a planilha institucional Painel Conselho 2026.');
  return {token, sheetId};
}

function buscarResumo_(token, spreadsheetId) {
  const res = UrlFetchApp.fetch(PRESCON_ENDPOINT, {
    method: 'get', headers: {Authorization: 'Bearer ' + token},
    muteHttpExceptions: true, followRedirects: false
  });
  if (res.getResponseCode() !== 200) {
    if (res.getResponseCode() === 401 || res.getResponseCode() === 403) throw Error('A chave foi revogada, expirou ou perdeu autorização. Gere uma nova na Central.');
    throw Error('Falha ao consultar a Central (HTTP ' + res.getResponseCode() + ').');
  }
  if (res.getContentText().length > 200000) throw Error('Resposta muito grande; sincronização interrompida.');
  const payload = JSON.parse(res.getContentText());
  if (payload.schema_version !== 1 || payload.scope !== 'council-summary-readonly' ||
      payload.target_spreadsheet_id !== spreadsheetId || !Array.isArray(payload.ejs) ||
      payload.ejs.length > 100 || !payload.totals) throw Error('O portal respondeu com dados incompatíveis; nada será alterado.');

  payload.ejs.forEach(e => {
    if (typeof e.ej !== 'string' || e.ej.length > 180 ||
       !['abertas','pendentes','andamento','justificadas','concluidas','vencidas'].every(k =>
         Number.isInteger(e[k]) && e[k] >= 0 && e[k] <= 100000)) {
      throw Error('Um indicador da resposta é inválido; nada será alterado.');
    }
  });
  return payload;
}

function numeroSeguro_(n) { return Number(n) || 0; }
function textoSeguro_(s) {
  const v = String(s).replace(/[\u0000-\u001F]/g, ' ').slice(0, 180);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
