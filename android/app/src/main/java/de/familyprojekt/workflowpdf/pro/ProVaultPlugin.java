package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.os.storage.*;
import android.text.InputType;
import android.util.Base64;
import android.view.View;
import android.widget.*;
import androidx.activity.result.ActivityResult;
import androidx.appcompat.app.AlertDialog;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Passwords are entered in an Android dialog and never cross the JavaScript bridge. */
@CapacitorPlugin(name="WorkflowVault")
public final class ProVaultPlugin extends Plugin {
    private final PluginWorker worker=new PluginWorker("vault");
    private final AtomicBoolean choosing=new AtomicBoolean();
    private VaultLocations locations;
    private ProTresorordner tresor;
    @Override public void load(){worker.execute(()->{locations=new VaultLocations(getContext());tresor=new ProTresorordner(getContext());});}
    private DocumentVault vault(PluginCall call)throws Exception{return locations.get(call.getString("location"));}
    private interface Work{JSONObject run()throws Exception;}
    private static String code(Exception error){
        String message=error.getMessage();
        if(message!=null&&message.matches("(VAULT|TRESOR)_[A-Z_]+"))return message;
        return error instanceof JSONException?"VAULT_DAMAGED":error instanceof SecurityException||error instanceof java.io.FileNotFoundException?"VAULT_FOLDER_UNAVAILABLE":"VAULT_UNAVAILABLE";
    }
    private void work(PluginCall call,Work task){worker.submit(call,()->{try{call.resolve(JSObject.fromJSONObject(task.run()));}catch(Exception error){String code=code(error);call.reject(code,code);}});}
    @PluginMethod public void state(PluginCall call){work(call,()->locations.state(call.getString("location")));}
    @PluginMethod public void locations(PluginCall call){work(call,()->new JSONObject().put("items",locations.list()));}
    @PluginMethod public void migration(PluginCall call){work(call,()->new JSONObject().put("location",locations.migration()==null?JSONObject.NULL:locations.migration()));}
    @PluginMethod public void prepareMigration(PluginCall call){work(call,()->{locations.prepareMigration(call.getString("location"));return new JSONObject().put("saved",true);});}
    @PluginMethod public void completeMigration(PluginCall call){work(call,()->{locations.completeMigration(call.getString("location"));return locations.state(null);});}
    @PluginMethod public void cancelMigration(PluginCall call){work(call,()->{locations.cancelMigration();return new JSONObject().put("saved",true);});}
    @PluginMethod public void beginBatch(PluginCall call){work(call,()->{vault(call).beginBatch();return new JSONObject().put("started",true);});}
    @PluginMethod public void commitBatch(PluginCall call){work(call,()->{vault(call).commitBatch();return new JSONObject().put("saved",true);});}
    @PluginMethod public void abortBatch(PluginCall call){work(call,()->{vault(call).abortBatch();return new JSONObject().put("aborted",true);});}
    @PluginMethod public void setPrimary(PluginCall call){work(call,()->{locations.select(call.getString("location"));return locations.state(null);});}
    @PluginMethod public void volumes(PluginCall call){work(call,()->{
        JSONArray out=new JSONArray();StorageManager storage=(StorageManager)getContext().getSystemService(Context.STORAGE_SERVICE);
        if(storage!=null)for(StorageVolume volume:storage.getStorageVolumes())if(android.os.Environment.MEDIA_MOUNTED.equals(volume.getState()))
            out.put(new JSONObject().put("id",volume.isPrimary()?"primary":String.valueOf(volume.getUuid())).put("primary",volume.isPrimary()).put("removable",volume.isRemovable()).put("label",volume.getDescription(getContext())));
        return new JSONObject().put("items",out);
    });}
    @PluginMethod public void choose(PluginCall call){
        if(worker.closed()){call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        Intent intent=null;String selected=call.getString("volume","");
        if(Build.VERSION.SDK_INT>=29&&!selected.isEmpty()){
            StorageManager storage=(StorageManager)getContext().getSystemService(Context.STORAGE_SERVICE);
            if(storage!=null)for(StorageVolume v:storage.getStorageVolumes())if(selected.equals(v.isPrimary()?"primary":String.valueOf(v.getUuid())))intent=v.createOpenDocumentTreeIntent();
        }
        if(intent==null)intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try{startActivityForResult(call,intent,"folderChosen");}
        catch(Exception error){choosing.set(false);call.reject("VAULT_FOLDER_UNAVAILABLE","VAULT_FOLDER_UNAVAILABLE");}
    }
    @ActivityCallback private void folderChosen(PluginCall call,ActivityResult result){
        if(call==null){choosing.set(false);return;}
        Intent data=result.getData();
        if(result.getResultCode()!=Activity.RESULT_OK||data==null||data.getData()==null){choosing.set(false);call.resolve(new JSObject().put("cancelled",true));return;}
        Uri tree=data.getData();int flags=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        worker.submit(call,()->{
            try{
                if(!"content".equals(tree.getScheme())||(data.getFlags()&flags)!=flags)throw new SecurityException();
                getContext().getContentResolver().takePersistableUriPermission(tree,flags);
                locations.ensureIdle();
                DocumentVault candidate=locations.candidate();DocumentVault.Place place=candidate.inspect(tree);boolean exists=candidate.existing(place);
                if(call.getString("expectedVaultId")!=null&&!exists)throw new java.io.IOException("VAULT_WRONG_FOLDER");
                getActivity().runOnUiThread(()->password(call,candidate,place,exists?1:0));
            }catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    @PluginMethod public void unlock(PluginCall call){
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        worker.submit(call,()->{
            try{DocumentVault selected=vault(call);getActivity().runOnUiThread(()->password(call,selected,null,2));}
            catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    private static final String[][] WORDS={
        {"Dokumenttresor einrichten","Create document vault","Создать хранилище документов","إنشاء خزنة المستندات"},
        {"Dokumenttresor öffnen","Open document vault","Открыть хранилище документов","فتح خزنة المستندات"},
        {"Passwort","Password","Пароль","كلمة المرور"},
        {"Passwort wiederholen","Repeat password","Повторить пароль","تأكيد كلمة المرور"},
        {"Passwort vergessen = Daten verloren. Ich bewahre es sicher auf.","Forgotten password = lost data. I will keep it safe.","Забытый пароль = потерянные данные. Я сохраню его надёжно.","نسيان كلمة المرور يعني فقدان البيانات. سأحتفظ بها بأمان."},
        {"Auf diesem Gerät entsperrt halten","Keep unlocked on this device","Оставить разблокированным на этом устройстве","الإبقاء على الخزنة مفتوحة على هذا الجهاز"},
        {"Abbrechen","Cancel","Отмена","إلغاء"},
        {"Weiter","Continue","Продолжить","متابعة"},
        {"Mindestens 10 Zeichen; beide Passwörter müssen übereinstimmen. Hinweis bestätigen.","Use at least 10 matching characters and confirm the notice.","Не менее 10 символов; пароли должны совпадать. Подтвердите предупреждение.","استخدم 10 أحرف على الأقل، وطابق كلمتي المرور وأكّد التنبيه."},
        {"Passwort falsch oder Speicherort nicht erreichbar. Keine Daten wurden zurückgesetzt.","Wrong password or storage unavailable. No data was reset.","Неверный пароль или хранилище недоступно. Данные не сброшены.","كلمة المرور غير صحيحة أو التخزين غير متاح. لم تتم إعادة تعيين البيانات."}
    };
    private void password(PluginCall call,DocumentVault vault,DocumentVault.Place place,int mode){
        if(worker.closed()||getActivity().isFinishing()||getActivity().isDestroyed()){choosing.set(false);call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        String language=call.getString("language","de");int index=Arrays.asList("de","en","ru","ar").indexOf(language);final int lang=index<0?0:index;
        java.util.function.IntFunction<String> t=n->WORDS[n][lang];
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*getContext().getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        if(lang==3)box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        EditText first=new EditText(getContext()),second=new EditText(getContext());
        for(EditText field:new EditText[]{first,second}){field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);if(Build.VERSION.SDK_INT>=26)field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);}
        first.setHint(t.apply(2));second.setHint(t.apply(3));box.addView(first);if(mode==0)box.addView(second);
        CheckBox notice=new CheckBox(getContext());notice.setText(t.apply(4));if(mode==0)box.addView(notice);
        CheckBox remember=new CheckBox(getContext());remember.setText(t.apply(5));remember.setChecked(true);box.addView(remember);
        TextView status=new TextView(getContext());box.addView(status);ScrollView scroll=new ScrollView(getContext());scroll.addView(box);
        AlertDialog.Builder builder=new AlertDialog.Builder(getActivity()).setTitle(t.apply(mode==0?0:1)).setView(scroll)
            .setNegativeButton(t.apply(6),(d,w)->{choosing.set(false);first.getText().clear();second.getText().clear();call.resolve(new JSObject().put("cancelled",true));})
            .setPositiveButton(t.apply(7),null);
        if(mode!=0)builder.setNeutralButton(R_WORDS[0][lang],(d,w)->{first.getText().clear();second.getText().clear();recoveryDialog(call,vault,place,mode,lang);});
        AlertDialog dialog=builder.create();
        dialog.setOnCancelListener(d->{choosing.set(false);first.getText().clear();second.getText().clear();call.resolve(new JSObject().put("cancelled",true));});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String p=java.text.Normalizer.normalize(first.getText(),java.text.Normalizer.Form.NFC);
            if(mode==0&&(p.codePointCount(0,p.length())<10||!p.equals(java.text.Normalizer.normalize(second.getText(),java.text.Normalizer.Form.NFC))||!notice.isChecked())){status.setText(t.apply(8));return;}
            boolean keep=remember.isChecked();dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
            worker.submit(call,()->{
                try{
                    if(mode==0)vault.initialize(place,p,keep);else if(mode==1)vault.open(place,p,keep);else vault.unlock(p,keep);
                    String expected=call.getString("expectedVaultId");
                    if(expected!=null&&!expected.equals(vault.identity())){vault.lock();throw new java.io.IOException("VAULT_WRONG_FOLDER");}
                    String location=mode==2?vault.locationId():locations.adopt(vault);
                    JSONObject state=locations.state(location);getActivity().runOnUiThread(()->{first.getText().clear();second.getText().clear();dialog.dismiss();choosing.set(false);call.resolve(new JSObject().put("location",location).put("state",state).put("created",mode==0).put("opened",mode==1).put("unlocked",true));});
                }catch(Exception error){getActivity().runOnUiThread(()->{first.getText().clear();second.getText().clear();status.setText(t.apply(9));dialog.setCancelable(true);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);});}
            });
        }));dialog.show();first.requestFocus();
    }
    private static final String[][] R_WORDS={
        {"Passwort vergessen?","Forgot password?","Забыли пароль?","نسيت كلمة المرور؟"},
        {"Mit Ersatzschlüsseln öffnen","Open with recovery keys","Открыть ключами восстановления","الفتح بمفاتيح الاسترداد"},
        {"Drei verschiedene Ersatzschlüssel eingeben und ein neues Passwort festlegen.","Enter three different recovery keys and choose a new password.","Введите три разных ключа восстановления и задайте новый пароль.","أدخل ثلاثة مفاتيح استرداد مختلفة واختر كلمة مرور جديدة."},
        {"Ersatzschlüssel","Recovery key","Ключ восстановления","مفتاح الاسترداد"},
        {"Neues Passwort","New password","Новый пароль","كلمة مرور جديدة"},
        {"Neues Passwort wiederholen","Repeat new password","Повторите новый пароль","أعد كتابة كلمة المرور الجديدة"},
        {"Wiederherstellen","Recover","Восстановить","استرداد"},
        {"Ein Ersatzschlüssel ist falsch abgetippt. Bitte Zeichen für Zeichen prüfen.","A recovery key contains a typo. Please check it character by character.","Ключ восстановления введён с ошибкой. Проверьте его посимвольно.","يحتوي أحد مفاتيح الاسترداد على خطأ. يرجى التحقق منه حرفاً حرفاً."},
        {"Bitte drei verschiedene Ersatzschlüssel desselben Satzes eingeben.","Enter three different recovery keys from the same set.","Введите три разных ключа из одного набора.","أدخل ثلاثة مفاتيح مختلفة من المجموعة نفسها."},
        {"Diese Ersatzschlüssel gehören nicht zu diesem Tresor oder sind veraltet.","These recovery keys do not belong to this vault or are outdated.","Эти ключи не относятся к этому хранилищу или устарели.","مفاتيح الاسترداد هذه لا تخص هذه الخزنة أو أنها قديمة."},
        {"Neues Passwort: mindestens 10 Zeichen, beide gleich.","New password: at least 10 characters, both identical.","Новый пароль: не менее 10 символов, оба одинаковые.","كلمة المرور الجديدة: 10 أحرف على الأقل ومتطابقة."},
        {"Wiederherstellung nicht möglich. Keine Daten wurden verändert.","Recovery not possible. No data was changed.","Восстановление невозможно. Данные не изменены.","تعذر الاسترداد. لم تتغير أي بيانات."},
        {"Ersatzschlüssel (3 von 5)","Recovery keys (3 of 5)","Ключи восстановления (3 из 5)","مفاتيح الاسترداد (3 من 5)"},
        {"Diese fünf Ersatzschlüssel getrennt aufbewahren, zum Beispiel ausgedruckt an verschiedenen Orten. Drei beliebige genügen, um ein vergessenes Passwort zu ersetzen. Wer drei Teile hat, kann den Tresor öffnen. Ältere Ersatzschlüssel gelten ab jetzt nicht mehr.","Keep these five recovery keys separately, e.g. printed in different places. Any three replace a forgotten password. Anyone holding three keys can open the vault. Older recovery keys are no longer valid.","Храните пять ключей раздельно, например распечатанными в разных местах. Любые три заменяют забытый пароль. Владелец трёх ключей может открыть хранилище. Прежние ключи больше не действуют.","احتفظ بمفاتيح الاسترداد الخمسة بشكل منفصل، مثلاً مطبوعة في أماكن مختلفة. أي ثلاثة منها تستبدل كلمة مرور منسية. من يملك ثلاثة مفاتيح يمكنه فتح الخزنة. المفاتيح القديمة لم تعد صالحة."},
        {"Als Datei speichern …","Save as file …","Сохранить в файл …","حفظ كملف …"},
        {"Ich habe alle fünf Ersatzschlüssel gespeichert oder aufgeschrieben.","I have saved or written down all five recovery keys.","Я сохранил или записал все пять ключей.","لقد حفظت أو دونت مفاتيح الاسترداد الخمسة."},
        {"Fertig","Done","Готово","تم"},
        {"Datei gespeichert und geprüft. Teile trotzdem getrennt aufbewahren.","File saved and verified. Still keep the keys separately.","Файл сохранён и проверен. Храните ключи раздельно.","تم حفظ الملف والتحقق منه. احتفظ بالمفاتيح منفصلة."},
        {"Datei konnte nicht gespeichert werden.","The file could not be saved.","Не удалось сохранить файл.","تعذر حفظ الملف."},
        {"Teil","Key","Ключ","المفتاح"}
    };
    private static String recoveryMessage(String code,int lang){
        int n="VAULT_RECOVERY_TYPO".equals(code)?7:"VAULT_RECOVERY_INCOMPLETE".equals(code)||"VAULT_RECOVERY_MIXED".equals(code)||"VAULT_RECOVERY_DUPLICATE".equals(code)?8:"VAULT_RECOVERY_UNKNOWN".equals(code)||"VAULT_RECOVERY_INVALID".equals(code)?9:"VAULT_PASSWORD_SHORT".equals(code)?10:11;
        return R_WORDS[n][lang];
    }
    /** Drei Ersatzschlüssel und ein neues Passwort; nur im nativen Dialog. */
    private void recoveryDialog(PluginCall call,DocumentVault vault,DocumentVault.Place place,int mode,int lang){
        if(worker.closed()||getActivity().isFinishing()||getActivity().isDestroyed()){choosing.set(false);call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*getContext().getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        if(lang==3)box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        TextView help=new TextView(getContext());help.setText(R_WORDS[2][lang]);box.addView(help);
        EditText[] keys=new EditText[3];
        for(int i=0;i<3;i++){keys[i]=new EditText(getContext());keys[i].setHint(R_WORDS[3][lang]+" "+(i+1));keys[i].setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS|InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS|InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);keys[i].setTypeface(android.graphics.Typeface.MONOSPACE);if(Build.VERSION.SDK_INT>=26)keys[i].setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);box.addView(keys[i]);}
        EditText first=new EditText(getContext()),second=new EditText(getContext());
        for(EditText field:new EditText[]{first,second}){field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);if(Build.VERSION.SDK_INT>=26)field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);}
        first.setHint(R_WORDS[4][lang]);second.setHint(R_WORDS[5][lang]);box.addView(first);box.addView(second);
        CheckBox remember=new CheckBox(getContext());remember.setText(WORDS[5][lang]);remember.setChecked(true);box.addView(remember);
        TextView status=new TextView(getContext());box.addView(status);ScrollView scroll=new ScrollView(getContext());scroll.addView(box);
        Runnable clear=()->{for(EditText k:keys)k.getText().clear();first.getText().clear();second.getText().clear();};
        AlertDialog dialog=new AlertDialog.Builder(getActivity()).setTitle(R_WORDS[1][lang]).setView(scroll)
            .setNegativeButton(WORDS[6][lang],(d,w)->{clear.run();choosing.set(false);call.resolve(new JSObject().put("cancelled",true));})
            .setPositiveButton(R_WORDS[6][lang],null).create();
        dialog.setOnCancelListener(d->{clear.run();choosing.set(false);call.resolve(new JSObject().put("cancelled",true));});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String p=java.text.Normalizer.normalize(first.getText(),java.text.Normalizer.Form.NFC);
            if(p.codePointCount(0,p.length())<10||!p.equals(java.text.Normalizer.normalize(second.getText(),java.text.Normalizer.Form.NFC))){status.setText(R_WORDS[10][lang]);return;}
            ArrayList<String> texts=new ArrayList<>();for(EditText k:keys)texts.add(k.getText().toString());
            boolean keep=remember.isChecked();dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
            worker.submit(call,()->{
                try{
                    if(mode==1)vault.recover(place,texts,p,keep);else vault.recoverStored(texts,p,keep);
                    texts.clear();
                    String expected=call.getString("expectedVaultId");
                    if(expected!=null&&!expected.equals(vault.identity())){vault.lock();throw new java.io.IOException("VAULT_WRONG_FOLDER");}
                    String location=mode==2?vault.locationId():locations.adopt(vault);
                    JSONObject state=locations.state(location);getActivity().runOnUiThread(()->{clear.run();dialog.dismiss();choosing.set(false);call.resolve(new JSObject().put("location",location).put("state",state).put("created",false).put("opened",mode==1).put("unlocked",true).put("recovered",true));});
                }catch(Exception error){texts.clear();String code=error.getMessage();getActivity().runOnUiThread(()->{first.getText().clear();second.getText().clear();status.setText(recoveryMessage(code,lang));dialog.setCancelable(true);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);});}
            });
        }));dialog.show();keys[0].requestFocus();
    }
    @PluginMethod public void recoveryInfo(PluginCall call){work(call,()->vault(call).recoveryInfo());}
    private List<String> shownShares;private AlertDialog sharesDialog;private TextView sharesStatus;private int sharesLang;
    /** Neue Ersatzschlüssel nur im nativen Dialog anzeigen; sie gelangen nie in die Webseite. */
    @PluginMethod public void createRecovery(PluginCall call){
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        String language=call.getString("language","de");int index=Arrays.asList("de","en","ru","ar").indexOf(language);final int lang=index<0?0:index;
        worker.submit(call,()->{
            try{
                DocumentVault v=vault(call);List<String> shares=v.createRecovery(VaultRecovery.DEFAULT_N,VaultRecovery.DEFAULT_K);JSONObject info=v.recoveryInfo();
                getActivity().runOnUiThread(()->showShares(call,shares,info,lang));
            }catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    private String sharesText(int lang){
        StringBuilder out=new StringBuilder("Workflow PDF Pro – ").append(R_WORDS[12][lang]).append("\n\n").append(R_WORDS[13][lang]).append("\n\n");
        for(int i=0;i<shownShares.size();i++)out.append(R_WORDS[19][lang]).append(' ').append(i+1).append("/").append(shownShares.size()).append(":  ").append(shownShares.get(i)).append("\n\n");
        return out.toString();
    }
    private void showShares(PluginCall call,List<String> shares,JSONObject info,int lang){
        if(worker.closed()||getActivity().isFinishing()||getActivity().isDestroyed()){choosing.set(false);call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        shownShares=new ArrayList<>(shares);sharesLang=lang;
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*getContext().getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        if(lang==3)box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        TextView help=new TextView(getContext());help.setText(R_WORDS[13][lang]);box.addView(help);
        for(int i=0;i<shares.size();i++){TextView line=new TextView(getContext());line.setText(R_WORDS[19][lang]+" "+(i+1)+":\n"+shares.get(i));line.setTypeface(android.graphics.Typeface.MONOSPACE);line.setTextIsSelectable(false);line.setPadding(0,pad/2,0,0);line.setContentDescription(R_WORDS[19][lang]+" "+(i+1));line.setTag("wfp-recovery-share");box.addView(line);}
        CheckBox confirm=new CheckBox(getContext());confirm.setText(R_WORDS[15][lang]);box.addView(confirm);
        sharesStatus=new TextView(getContext());box.addView(sharesStatus);ScrollView scroll=new ScrollView(getContext());scroll.addView(box);
        AlertDialog dialog=new AlertDialog.Builder(getActivity()).setTitle(R_WORDS[12][lang]).setView(scroll).setCancelable(false)
            .setNeutralButton(R_WORDS[14][lang],null).setPositiveButton(R_WORDS[16][lang],null).create();
        sharesDialog=dialog;
        dialog.setOnShowListener(d->{
            android.widget.Button done=dialog.getButton(AlertDialog.BUTTON_POSITIVE);done.setEnabled(false);
            confirm.setOnCheckedChangeListener((b,checked)->done.setEnabled(checked));
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain").putExtra(Intent.EXTRA_TITLE,"Workflow-PDF-Pro-Ersatzschluessel.txt");
                try{startActivityForResult(call,intent,"sharesSaved");}catch(Exception error){sharesStatus.setText(R_WORDS[18][lang]);}
            });
            done.setOnClickListener(v->{
                shownShares=null;sharesDialog=null;dialog.dismiss();choosing.set(false);
                call.resolve(new JSObject().put("created",true).put("set",info.optString("set")).put("n",info.optInt("n")).put("k",info.optInt("k")).put("createdAt",info.optLong("created")));
            });
        });
        dialog.show();
    }
    @ActivityCallback private void sharesSaved(PluginCall call,ActivityResult result){
        if(shownShares==null||sharesStatus==null)return;
        Intent data=result.getData();int lang=sharesLang;
        if(result.getResultCode()!=Activity.RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();byte[] text=sharesText(lang).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        worker.execute(()->{
            boolean ok=false;
            try{
                if(!"content".equals(uri.getScheme()))throw new SecurityException();
                try(java.io.OutputStream out=getContext().getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new java.io.IOException();out.write(text);}
                try(java.io.InputStream in=getContext().getContentResolver().openInputStream(uri)){java.io.ByteArrayOutputStream back=new java.io.ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)back.write(b,0,n);ok=Arrays.equals(back.toByteArray(),text);}
            }catch(Exception error){ok=false;}
            Arrays.fill(text,(byte)0);boolean saved=ok;
            getActivity().runOnUiThread(()->{if(sharesStatus!=null)sharesStatus.setText(R_WORDS[saved?17:18][lang]);});
        });
    }
    @PluginMethod public void lock(PluginCall call){work(call,()->{locations.lock();return locations.state(null);});}
    @PluginMethod public void begin(PluginCall call){work(call,()->new JSONObject().put("ticket",vault(call).begin(call.getString("store"),call.getString("id"),call.getData().optJSONObject("reference"))));}
    @PluginMethod public void append(PluginCall call){work(call,()->{
        String data=call.getString("data","");if(data.length()>349528)throw new java.io.IOException("VAULT_INVALID_TRANSFER");
        vault(call).append(call.getString("ticket"),ProFilesPlugin.integer(call.getData().opt("offset")),Base64.decode(data,Base64.NO_WRAP));return new JSONObject().put("ok",true);
    });}
    @PluginMethod public void finish(PluginCall call){work(call,()->{DocumentVault v=vault(call);v.finish(call.getString("ticket"),ProFilesPlugin.integer(call.getData().opt("size")));return v.info(call.getString("store"),call.getString("id")).put("saved",true);});}
    @PluginMethod public void abort(PluginCall call){work(call,()->{vault(call).abort(call.getString("ticket"));return new JSONObject();});}
    @PluginMethod public void info(PluginCall call){work(call,()->vault(call).info(call.getString("store"),call.getString("id")));}
    @PluginMethod public void read(PluginCall call){work(call,()->new JSONObject().put("data",Base64.encodeToString(vault(call).read(call.getString("store"),call.getString("id"),ProFilesPlugin.integer(call.getData().opt("offset")),call.getString("hash")),Base64.NO_WRAP)));}
    @PluginMethod public void list(PluginCall call){work(call,()->new JSONObject().put("ids",vault(call).list(call.getString("store"))));}
    @PluginMethod public void remove(PluginCall call){work(call,()->{vault(call).remove(call.getString("store"),call.getString("id"),call.getBoolean("prefix",false));return new JSONObject().put("saved",true);});}
    // ---------- Gemeinsamer Tresorordner (Schritt D1, Klaus 2026-10-27) ----------
    // Der Knopf „In den Tresorordner einziehen“ steht im Tresor-Kasten der Einstellungen. Gewählt wird die Ebene ÜBER
    // „Workflow PDF Pro“; sie passt nur, wenn darin genau der entsperrte Tresor liegt (auch als Kopie, für die Probe).
    // Passwort nur im nativen Dialog; der Datenschlüssel verlässt Java nicht (TresorEinzug, ProTresorordner).
    private static final String[][] T_WORDS={
        {"Tresorordner anlegen","Create shared vault folder","Создать общую папку-хранилище","إنشاء مجلد الخزنة المشترك"},
        {"Tresorordner entsperren","Unlock shared vault folder","Разблокировать общую папку-хранилище","فتح مجلد الخزنة المشترك"},
        {"Ein Passwort für alle Pro-Apps (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). Es verlässt das Gerät nie. Mindestens 10 Zeichen.","One password for all Pro apps (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). It never leaves the device. At least 10 characters.","Один пароль для всех Pro-приложений (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). Он не покидает устройство. Не менее 10 символов.","كلمة مرور واحدة لكل تطبيقات Pro (Private Brain Pro وWorkflow PDF Pro وBookLedgerPro). لا تغادر الجهاز أبداً. 10 أحرف على الأقل."},
        {"Das Passwort des Tresorordners (dasselbe wie in den anderen Pro-Apps).","The shared vault folder password (the same as in the other Pro apps).","Пароль общей папки (тот же, что в других Pro-приложениях).","كلمة مرور المجلد المشترك (نفسها في تطبيقات Pro الأخرى)."},
        {"Passwort vergessen = ohne Ersatzschlüssel kein Zugang. Ich bewahre es sicher auf.","Forgotten password = no access without recovery keys. I will keep it safe.","Забытый пароль = без ключей восстановления доступа нет. Я сохраню его надёжно.","نسيان كلمة المرور يعني عدم الوصول بدون مفاتيح الاسترداد. سأحتفظ بها بأمان."},
        {"Passwort falsch oder Ordner nicht erreichbar. Nichts wurde verändert.","Wrong password or folder unavailable. Nothing was changed.","Неверный пароль или папка недоступна. Ничего не изменено.","كلمة المرور غير صحيحة أو المجلد غير متاح. لم يتغير شيء."}
    };
    private DocumentVault vaultOrNull(PluginCall call){try{return vault(call);}catch(Exception error){return null;}}
    @PluginMethod public void tresorZustand(PluginCall call){work(call,()->tresor.zustand(vaultOrNull(call)));}
    @PluginMethod public void tresorSperren(PluginCall call){work(call,()->{tresor.sperren(call.getBoolean("vergessen",false));return tresor.zustand(vaultOrNull(call));});}
    @PluginMethod public void tresorVerzeichnis(PluginCall call){work(call,()->{JSONArray zeilen=call.getData().optJSONArray("zeilen");if(zeilen==null)throw new java.io.IOException("TRESOR_EINTRAG_UNGUELTIG");return tresor.verzeichnis(zeilen,vault(call));});}
    @PluginMethod public void tresorEinziehen(PluginCall call){
        if(worker.closed()){call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        worker.submit(call,()->{
            try{
                DocumentVault v=vault(call);byte[] probe=v.tresorSchluessel();Arrays.fill(probe,(byte)0); // nur entsperrt
                boolean neu=call.getBoolean("neuWaehlen",false)||!tresor.gewaehlt();
                if(!neu){try{neu=!"PASST".equals(tresor.pruefung(v.identity()));}catch(java.io.IOException unerreichbar){neu=true;}}
                if(neu){getActivity().runOnUiThread(()->tresorOrdnerWaehlen(call));return;}
                tresorWeiter(call,v);
            }catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    private void tresorOrdnerWaehlen(PluginCall call){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try{startActivityForResult(call,intent,"tresorGewaehlt");}
        catch(Exception error){choosing.set(false);call.reject("TRESOR_ORDNER_NICHT_ERREICHBAR","TRESOR_ORDNER_NICHT_ERREICHBAR");}
    }
    @ActivityCallback private void tresorGewaehlt(PluginCall call,ActivityResult result){
        if(call==null){choosing.set(false);return;}
        Intent data=result.getData();
        if(result.getResultCode()!=Activity.RESULT_OK||data==null||data.getData()==null){choosing.set(false);call.resolve(new JSObject().put("abgebrochen",true));return;}
        Uri tree=data.getData();int flags=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        worker.submit(call,()->{
            try{
                if(!"content".equals(tree.getScheme())||(data.getFlags()&flags)!=flags)throw new SecurityException();
                getContext().getContentResolver().takePersistableUriPermission(tree,flags);
                DocumentVault v=vault(call);String pruefung=tresor.pruefen(tree,v.identity());
                // Nichts übernehmen, wenn der Ordner nicht genau diesen Tresor enthält. Die Freigabe bleibt (sie kann die des Tresors selbst sein).
                if(!"PASST".equals(pruefung))throw new java.io.IOException("TRESOR_ORDNER_"+pruefung);
                tresor.baumSetzen(tree);
                tresorWeiter(call,v);
            }catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    /** Auf dem Arbeits-Thread: offen oder gemerkt → gleich einziehen, sonst Passwort-Dialog. */
    private void tresorWeiter(PluginCall call,DocumentVault v)throws Exception{
        tresor.entsperrenGewuenscht();
        if(tresor.istOffen()||tresor.gemerktEntsperren()){tresor.einziehen(v);choosing.set(false);call.resolve(JSObject.fromJSONObject(tresor.zustand(v).put("eingezogenJetzt",true)));return;}
        boolean anlegen=!tresor.vorhanden();
        getActivity().runOnUiThread(()->tresorPasswort(call,v,anlegen));
    }
    private void tresorPasswort(PluginCall call,DocumentVault v,boolean anlegen){
        if(worker.closed()||getActivity().isFinishing()||getActivity().isDestroyed()){choosing.set(false);call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        String language=call.getString("language","de");int index=Arrays.asList("de","en","ru","ar").indexOf(language);final int lang=index<0?0:index;
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*getContext().getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        if(lang==3)box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        TextView help=new TextView(getContext());help.setText(T_WORDS[anlegen?2:3][lang]);box.addView(help);
        EditText first=new EditText(getContext()),second=new EditText(getContext());
        for(EditText field:new EditText[]{first,second}){field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);if(Build.VERSION.SDK_INT>=26)field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);}
        first.setHint(WORDS[2][lang]);second.setHint(WORDS[3][lang]);box.addView(first);if(anlegen)box.addView(second);
        CheckBox notice=new CheckBox(getContext());notice.setText(T_WORDS[4][lang]);if(anlegen)box.addView(notice);
        CheckBox remember=new CheckBox(getContext());remember.setText(WORDS[5][lang]);remember.setChecked(true);box.addView(remember);
        TextView status=new TextView(getContext());box.addView(status);ScrollView scroll=new ScrollView(getContext());scroll.addView(box);
        Runnable clear=()->{first.getText().clear();second.getText().clear();};
        AlertDialog dialog=new AlertDialog.Builder(getActivity()).setTitle(T_WORDS[anlegen?0:1][lang]).setView(scroll)
            .setNegativeButton(WORDS[6][lang],(d,w)->{clear.run();choosing.set(false);call.resolve(new JSObject().put("abgebrochen",true));})
            .setPositiveButton(WORDS[7][lang],null).create();
        dialog.setOnCancelListener(d->{clear.run();choosing.set(false);call.resolve(new JSObject().put("abgebrochen",true));});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(x->{
            String p=java.text.Normalizer.normalize(first.getText(),java.text.Normalizer.Form.NFC);
            if(p.codePointCount(0,p.length())<10||anlegen&&(!p.equals(java.text.Normalizer.normalize(second.getText(),java.text.Normalizer.Form.NFC))||!notice.isChecked())){status.setText(WORDS[8][lang]);return;}
            boolean keep=remember.isChecked();dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
            worker.submit(call,()->{
                try{
                    tresor.mitPasswort(p,anlegen,keep,v);
                    JSObject state=JSObject.fromJSONObject(tresor.zustand(v).put("eingezogenJetzt",true).put("angelegt",anlegen));
                    getActivity().runOnUiThread(()->{clear.run();dialog.dismiss();choosing.set(false);call.resolve(state);});
                }catch(Exception error){
                    String code=code(error);
                    // Ein falsches Passwort darf neu versucht werden; ein belegtes Fach oder ein anderer Ordner nicht.
                    if("TRESOR_PASSWORT".equals(code)||"TRESOR_PASSWORT_FALSCH".equals(code)||"TRESOR_ORDNER_NICHT_ERREICHBAR".equals(code))
                        getActivity().runOnUiThread(()->{clear.run();status.setText(T_WORDS[5][lang]);dialog.setCancelable(true);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);});
                    else getActivity().runOnUiThread(()->{clear.run();dialog.dismiss();choosing.set(false);call.reject(code,code);});
                }
            });
        }));dialog.show();first.requestFocus();
    }
    @Override protected void handleOnDestroy(){worker.close(()->{tresor.schliessen();locations.close();});}
}
